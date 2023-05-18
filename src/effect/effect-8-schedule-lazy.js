/**
 * 【computed: lazy 的effect + 缓存值】
 * 当前情形：使用 effect 注册副作用函数时，会立即执行传递给他的副作用函数
 * 解析：
 * 1. 当 options.lazy 为 true 时，不立即执行副作用函数
 * 2. 当注册副作用函数时，将副作用函数作为返回值返回，并在该函数中返回真正的副作用函数的执行结果
 * 3. 获取注册函数的返回值，手动调用该函数，获取副作用函数执行结果
 */

let activeEffect

const effectStack = []

// 注册函数
function effect(fn, options = {}) {
    /**
     * fn 才是真正的副作用函数，effectFn 是包装后的副作用函数
     * 调用 fn() 获取真正故作用函数的执行结果
     */
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        // 将副作用函数执行的结果存储到 res 中
        const res = fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        // 将 res 作为 effectFn 的返回值
        return res
    }
    effectFn.options = options
    effectFn.deps = []
    // 只有非 lazy 的时候，才立即执行副作用函数
    if (!options.lazy) {
        effectFn()
    }
    // 否则，将副作用函数作为返回值返回
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
    effectsToRun.forEach(fn => {
        if (fn.options.scheduler) {
            fn.options.scheduler(fn)
        } else {
            fn()
        }
    })
}

// const effectFn = effect(
//     () => {
//         return obj.foo++
//     },
//     // options
//     { lazy: true })

// setTimeout(() => {
//     // 手动执行副作用函数，获取副作用执行结果
//     const value = effectFn()
//     console.log('lazy effect', value)
// }, 3000)


// 计算属性的实现

function computed(getter) {
    // 用来缓存上一次计算的值
    let value
    // 用来标识是否需要重新计算值，为 true 则表示需要计算
    let dirty = true

    const effectFn = effect(getter, {
        lazy: true,
        // 添加调度器，在调度器中将 dirty 重置为 true
        // 调度器是在副作用函数重新执行时调用的
        scheduler() {
            dirty = true
        }
    })

    const obj = {
        get value() {
            // console.log('effect invoked')
            // return effectFn()
            /**
             * 只有“脏”值，才需要重新计算值，并缓存到 value 中
             */
            if (dirty) {
                value = effectFn()
                // 将 dirty 设置为 false，下一次访问直接使用缓存中的值
                dirty = false
            }
            return value
        }
    }

    /**
     * 返回一个对象，该对象的 value 属性是一个访问器属性，只有当读取 value 的值时，才会执行 effectFn 并将结果作为返回值返回
     */
    return obj
}

// 实验
const sumVal = computed(() => obj.foo + obj.bar)

setTimeout(() => {
    obj.foo++
    console.log('sumVal', sumVal.value)
}, 3000)

/**
 * 当在一个 effect 中读取计算属性的值时，形成了典型的 effect 嵌套
 * 1. 计算属性内部有用自己的 effect（lazy effect），getter 会被作为响应数据的依赖收集起来
 * 2. 把计算属性用于另外一个 effect 时，发生嵌套，外层的 effectF1 不会被内层的 副作用函数（getter）中的响应式数据作为依赖收集
 * 3. 所以，响应性数据变化时，无法触发外层副作用函数 effectF1 重新执行
 * 解决：
 * 1. 访问计算属性时，手动调用 track 函数进行追踪
 * 2. 当计算属性依赖的响应式数据变化时，手动调用 trigger 函数触发响应
 */
effect(function effectF1() {
    console.log(sumVal.value)
})

/**
 * setTimeout(()=>{ console.log(sumVal.value) },1000)
 * 输出结果：
    effect invoked
    3
 */