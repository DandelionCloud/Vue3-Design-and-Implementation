/**
 * 【完善触发响应】
 * 1. 设置操作发生，但是没有值发生变化，不需要触发响应
 */

// 用一个全局变量存储 当前被激活的 的副作用函数
let activeEffect

// effect 栈
const effectStack = []

function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    effectFn.deps = []
    effectFn()
}

function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.lenght = 0
}

// 存储副作用函数的“桶”
const bucket = new WeakMap()

// 原始数据
const data = {
    foo: 1,
    get bar() { return this.foo }
}

const ITERATE_KEY = Symbol()
// 对原始数据的代理
const obj = new Proxy(data, {
    /**
     * target: 原始对象 data
     * receiver：代理对象 obj
     */
    get(target, key, receiver) {
        track(target, key)
        return Reflect.get(target, key, receiver)
    },
    // 拦截设置操作
    set(target, key, newVal, receiver) {
        const oldValue = target[key]
        const type = Object.prototype.hasOwnProperty.call(target, key) ? "SET" : "ADD"
        const res = Reflect.set(target, key, newVal, receiver)
        // 比较新值与旧值，只有当它们不全等，且不都是 NaN 的时候才触发响应（NaN !== NaN）
        if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
            trigger(target, key, type)
        }
        return res
    },
    // 拦截 in 操作符
    has(target, key) {
        track(target, key)
        return Reflect.has(target, key)
    },
    // 拦截 for...in 循环
    ownKeys(target) {
        track(target, ITERATE_KEY)
        return Reflect.ownKeys(target)
    },
    // 拦截 delete 操作
    deleteProperty(target, key) {
        const hadKey = Object.prototype.hasOwnProperty.call(target, key)
        const res = Reflect.deleteProperty(target, key)
        if (res && hadKey) {
            trigger(target, key, "DELETE")
        }
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

/**
 * 设置函数 set 中调用 trigger() 触发变化
 * @param {*} target 目标对象
 * @param {*} key 属性名
 * @param {*} type 操作类型
 * @returns 
 */
function trigger(target, key, type) {
    const depsMap = bucket.get(target)
    if (!depsMap) { return }
    const effects = depsMap.get(key)
    const effectsToRun = new Set()
    effects && effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    // 只有当操作类型为 "ADD" 或 'DELETE' 时，才触发与 ITERATE_KEY 相关联的副作用函数重新执行
    if (type === 'ADD' || type === 'DELETE') {
        const iterateEffects = depsMap.get(ITERATE_KEY)
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }
    effectsToRun.forEach(fn => fn())
}