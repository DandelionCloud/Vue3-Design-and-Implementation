/**
 * 【watch】-简易实现（effect + scheduler）
 * watch 本质：观测一个响应式数据，当数据发生变化时通知并执行相应的回调函数
 * scheduler：响应式数据变化时调用，可在这里调用回调函数
 * 注意：回调函数在 scheduler 函数中执行，所以第一次回调函数并不会执行
 */

let activeEffect

const effectStack = []

// 注册函数
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        return res
    }
    effectFn.options = options
    effectFn.deps = []
    if (!options.lazy) {
        effectFn()
    }
    return effectFn
}

function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.lenght = 0
}

const bucket = new WeakMap()

const data = { foo: 1, bar: 2 }

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

/**
 * track 函数：用来追踪和收集依赖
 * 1. 这是一个独立的函数，根据传入的对象 target 及其属性 key，将当前副作用函数（activeEffect）收集到 key 的依赖集合中
 * 2. 相当于在“桶” bucket 中增加一条分支，记录 target、key、activeEffect 的依赖关系
 */
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
 * trigger 函数：用来触发副作用函数重新执行（响应式数据发生变化时）
 * 1. 这是一个独立的函数，根据传入的对象 target 及其属性 key，从“桶”中找出 key 的依赖集合（副作用函数集合），并执行这些副作用函数
 */
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
    effectsToRun.forEach(fn => {
        if (fn.options.scheduler) {
            fn.options.scheduler(fn)
        } else {
            fn()
        }
    })
}

/**
 * watch 的简易实现 - 硬编码 source.foo
 * @param {*} source 响应式数据
 * @param {*} cb 回调函数
 */
function watch(source, cb) {
    effect(
        // 读取 source.foo 属性，触发 track 函数，建立副作用函数和响应式数据之间的联系
        () => source.foo,
        {
            scheduler() {
                // 响应式数据变化时，调用回调函数
                cb()
            }
        }
    )
}

watch(obj, () => {
    console.log('数据变化了', obj.foo, obj.bar)
})

setTimeout(() => {
    obj.foo++
}, 3000)


setTimeout(() => {
    // 硬编码读取 obj.foo，obj.bar 与 副作用函数没有建立联系
    // 因此 obj.bar 变化时，无法触发 trigger 触发副作用函数重新执行
    obj.bar++
}, 1000)

/**
 * 输出结果：
   --- 3秒后---
   数据变化了 2 3

 * 解释：硬编码读取了 source.foo，只建立 foo 与 副作用函数之间的联系，bar 的变化无法响应到副作用函数上
 */