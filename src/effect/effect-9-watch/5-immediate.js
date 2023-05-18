/**
 * 【watch】（本质：观测一个响应式数据，当数据发生变化时通知并执行相应的回调函数）
 * （effect + options.scheduler）
 * 
 * 注意：回调函数在 scheduler 函数中执行，所以第一次回调函数并不会执行
 * 
 * 问题：watch 的特性1 --- 立即执行的回调函数
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
    effectFn.deps.length = 0
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
 * watch 的实现 - 立即执行的回调函数
 * @param {*} source 响应式数据或 getter 函数
 * @param {*} cb 回调函数
 * @param {*} options 选项参数
 * 
 * immediate：指定回调函数立即执行
 */
function watch(source, cb, options) {
    let getter
    if (typeof source === 'function') {
        getter = source
    } else {
        getter = () => traverse(source)
    }
    let oldValue, newValue

    /**
     * 提取 scheduler 调度函数为一个独立的 job 函数
     * 注意：回调函数立即执行时，保证新旧值的变化一致
     * 所以：提取时，带新旧值的赋值操作一起
     */
    const job = () => {
        newValue = effectFn()
        cb(newValue, oldValue)
        oldValue = newValue
    }

    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler: job
        }
    )

    /**
     * 当 immediate 为 true 时立即执行 job 函数，从而触发回调执行
     * 所以，第一次回调函数执行时，没有旧值，oldValue 为 undefined
     */
    if (options.immediate) {
        job()
    } else {
        oldValue = effectFn()
    }
}

/**
 * traverse 递归的读取一个对象上的任意属性  ======>  当任意属性发生变化时都能够触发副作用函数重新执行
 * @param {*} value 
 * @param {*} seen 
 * @returns
 * 注释：
 * 1. 副作用函数读取一个属性值，就会建立副作用函数和这个对象及其属性的联系
 */
function traverse(value, seen = new Set()) {
    // value是原始值：如果要读取的数据是原始值、被读取过了，则什么都不做
    if (typeof value !== 'object' || value === null || seen.has(value)) {
        return
    }
    // 将数据添加到 seen 中，表示已读取（避免循环引用导致的死循环）
    seen.add(value)
    // value是对象：递归的处理 value 对象中的属性值
    for (const k in value) {
        traverse(value[k], seen)
    }
    return value
}

watch(() => obj.foo, (newVal, oldVal) => {
    if (!oldVal) {
        console.log('回调立即执行！')
    } else {
        console.log('数据变化了')
    }
    console.log(newVal, oldVal)
}, {
    // 回调函数在 watch 创建时立即执行一次
    immediate: true
})

setTimeout(() => {
    console.log('foo++')
    obj.foo++
}, 3000)


/**
 * 输出结果：
   回调立即执行！
   1 undefined
   foo++
   数据变化了
   2 1
 */