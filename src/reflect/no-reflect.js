/**
 * 问题：响应失效
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
    effectFn.deps.length = 0
}

// 存储副作用函数的“桶”
const bucket = new WeakMap()

// 原始数据
const data = {
    foo: 1,
    get bar() {
        return this.foo
    },
    baz: {
        get() { return this.foo }
    }
}

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
    const effectsToRun = new Set()
    effects && effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    effectsToRun.forEach(fn => fn())
}


effect(() => {
    console.log('读取 bar 属性', obj.bar)
})

setTimeout(() => {
    console.log('修改响应式数据：', data.foo)
    obj.foo++
    console.log('原始数据 data 也会变', data.foo)
}, 1000)


/**
 * 输出结果：
    读取 bar 属性 1
    --- 3秒后 ---
    修改响应式数据： 1
    原始数据 data 也会变 2
 * 分析：
    1. 拦截函数内通过 target[key] 返回属性值，直接操作的是原始值
        p.bar => get() 返回 target[key] 即 data.bar => bar 属性的 getter 函数内的 this 指向原始对象 data，所以最终访问的是 data.foo
    2. effect(()=>console.log(data.foo))
        副作用函数中访问原始对象的某一个属性，不会建立响应联系
 */