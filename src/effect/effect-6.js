/**
 * 问题：嵌套的 effect
 * 解释：
 * 1. 全局变量 activeEffect 用来存储通过 effect() 注册的副作用函数，即：同一时刻 activeEffect 所存储的副作用函数只有一个
 * 2. 当副作用发生嵌套时，内层副作用函数的执行会覆盖 activeEffect 的值，且永远不会恢复到原来的值
 * 3. 如果此时响应式数据进行依赖收集，收集到的副作用函数是内层副作用函数
 * 
 * 解决：副作用函数栈 effectStack  ----->    一个响应式数据只会收集直接读取其值的副作用函数
 * 1. 副作用函数执行时，将当前副作用函数压入栈中
 * 2. 副作用函数执行完毕，从栈中弹出
 * 3. activeEffect 始终指向栈顶的副作用函数
 * 
 * 结论：
 * 1. activeEffect 始终指向栈顶，当前执行的副作用函数
 * 2. 副作用函数发生嵌套时，栈底存储外层副作用函数（effect1），栈顶存储内侧副作用函数（effect2）
 * 3. 当内层副作用函数 effect2 执行完毕时，被弹出栈，activeEffect 被设置为 effect1
 */

// 用一个全局变量存储 当前被激活的 的副作用函数
let activeEffect

// effect 栈
const effectStack = []

/**
 * 用于注册副作用函数的 effect 函数
 * 1. deps 中存储所有与该副作用函数关联的依赖集合
 */
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn)
        // 当 effectFn 执行时，将其设置为当前激活的副作用函数
        activeEffect = effectFn
        /**
         * 1. 在调用副作用函数之前，将当前副作用函数压入栈中
         * 2. 在当前副作用函数执行完毕后，将当前副作用函数从栈中弹出
         * 3. 将 activeEffect 还原为之前的值
         */
        effectStack.push(effectFn)
        fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
    effectFn.deps = []
    // 执行副作用函数
    effectFn()
}

function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.length = 0
}

// 存储副作用函数的桶
const bucket = new WeakMap()

// 原始数据
const data = { foo: true, bar: true }

// 对原始数据的代理
const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
        track(target, key)
        // 返回属性值
        return target[key]
    },
    // 拦截设置操作
    set(target, key, newVal) {
        // 设置属性值
        target[key] = newVal
        trigger(target, key)
    }
})

// 拦截函数 get 中调用 track() 追踪变化
function track(target, key) {
    if (!activeEffect) return
    let depsMap = bucket.get(target)
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, deps = new Set())
    }
    deps.add(activeEffect)
    activeEffect.deps.push(deps)
}

// 设置函数 set 中调用 trigger() 触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)
    if (!depsMap) { return }
    const effects = depsMap.get(key)
    const effectsToRun = new Set(effects)
    effectsToRun && effectsToRun.forEach(fn => fn())
}

let temp1, temp2

effect(function effect1() {
    console.log('effect1执行')
    effect(function effect2() {
        console.log('effect2执行')
        temp2 = obj.bar // effect2 中读取 obj.bar 属性
    })
    temp1 = obj.foo     // effect1 中读取 obj.foo 属性
})

// 遗留副作用的验证
setTimeout(() => {
    console.log('set value')
    obj.foo = false
}, 3000)


/**
 * 输出结果（正确）：
    effect1 执行
    effect1 执行
    --- 3秒后 ---
    set value
    effect2 执行
    effect2 执行
 */