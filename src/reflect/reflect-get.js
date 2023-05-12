/**
 * 问题：响应失效
 * 解决：通过 Reflect.get 函数的第三个参数来改变函数调用中的 this
 * 1. 拦截操作中使用 Reflect.* 方法进行拦截，如 Reflect.get() 可以接受第三个参数，指明是谁在读取值，即 this
 * 
 * Reflect(target, key, receiver) 参数解释：
 * - target：被代理的原始对象
 * - key：属性名
 * - receiver：真正读取属性的对象，即代理对象
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
    get bar() {
        /**
         * 根据 Reflect.get(target, key, receiver) 的第三个参数指明的代理对象，
         * 此处的 this 即 receiver，即代理对象 obj
         * 所以，读取响应式对象的属性，可以建立响应联系
         */
        return this.foo
    },
    baz: {
        get() { return this.foo }
    }
}

// 对原始数据的代理
const obj = new Proxy(data, {
    /**
     * 拦截读取操作，接受第三个参数 receiver
     * receiver: 表示是谁在读取属性值，即代理对象 obj
     * 读取 obj.bar 的值，其中的 obj 就是 receiver
     */
    get(target, key, receiver) {
        track(target, key)
        // 使用 Reflect.get 返回读取到的属性值
        return Reflect(target, key, receiver) 
    },
    // 拦截设置操作l
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
