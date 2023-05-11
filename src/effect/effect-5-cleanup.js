/**
 * 问题：分支切换 导致 遗留的副作用函数
 * document.body.innerText = obj.ok ? obj.text : 'not'
 * 分支切换：根据 obj.ok 值的不同会执行不同的代码分支
 */

// 用一个全局变量存储被注册的副作用函数
let activeEffect

// effect 用于注册副作用函数
function effect(fn) {
    // 调用 effect 注册副作用函数时，将副作用函数 fn 赋值给 activeEffect
    activeEffect = fn
    // 执行副作用函数
    fn()
}

// 存储副作用函数的桶
const bucket = new WeakMap()

// 原始数据
const data = { ok: true, text: 'Hello Vue world-4' }

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
}

// 设置函数 set 中调用 trigger() 触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)
    if (!depsMap) { return }
    const effects = depsMap.get(key)
    effects && effects.forEach(fn => fn())
}

effect(() => {
    console.log('effect invoke')
    document.body.innerText = obj.ok ? obj.text : 'not'
})

// 遗留副作用的验证
setTimeout(() => {
    console.log('set value')
    obj.text = 'hello effect4'
}, 3000)

setTimeout(() => {
    obj.ok = false
}, 1000)
