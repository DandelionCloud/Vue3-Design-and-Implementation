/**
 * 问题：无限递归循环（读取和设置操作在同一个副作用函数中进行时）
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
const data = { foo: 1, bar: 1 }

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
    obj.foo++
    /**
     * 导致栈溢出问题：Uncaught RangeError: Maximum call stack size exceeded
     * 语句拆解：obj.foo = obj.foo + 1
     * 1. 读取操作，触发 track(), 将当前副作用函数收集到 effectStack 中
     * 2. 加1赋值操作，触发 trigger(), 将副作用取出并执行
     */
})
