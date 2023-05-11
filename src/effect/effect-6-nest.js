/**
 * 问题：嵌套的 effect
 */

// 用一个全局变量存储被注册的副作用函数
let activeEffect

/**
 * 用于注册副作用函数的 effect 函数
 * 1. deps 中存储所有与该副作用函数关联的依赖集合
 */
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn)
        // 当 effectFn 执行时，将其设置为当前激活的副作用函数
        activeEffect = effectFn
        fn()
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
    effectFn.deps.lenght = 0
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
 * 输出结果（错误）：
    effect1 执行
    effect2 执行
    --- 3秒后 ---
    effect2 执行

 * 问题：设置 obj.foo 的值，导致了内层嵌套的 effect2 执行
 */

