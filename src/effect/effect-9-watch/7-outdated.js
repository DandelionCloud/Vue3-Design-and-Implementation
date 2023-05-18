/**
 * 问题：竞态问题
 * 解析：需要一个让副作用函数过期的手段
 * 
 * 以 watch 函数来复现竞态问题产生的场景 
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
 * watch 的实现 - 副作用函数（这里指回调函数）过期
 * @param {*} source 响应式数据或 getter 函数
 * @param {*} cb 回调函数（接受三个参数：newVal oldVal onInvalidate）
                - @param {*} newVal 新值
                - @param {*} oldVal 旧值
                - @param {*} onInvalidate 注册过期回调
 * @param {*} options 选项参数
 * 
 * immediate：指定回调函数立即执行
 * flush: 指定调度器的执行时机
 * 
 * onInvalidate: 指定副作用函数的过期回调
 * 解释：在 watch 内检测到变化后，在副作用函数重新执行前，先调用过期回调
 */

function watch(source, cb = function (newVal, oldVal, onInvalidate) { }, options) {
    let getter
    if (typeof source === 'function') {
        getter = source
    } else {
        getter = () => traverse(source)
    }
    let oldValue, newValue

    /**
     * 1. cleanup：用来存储用户注册的过期回调
     * 2. onInvalidate 函数：获取用户注册的过期回调，并存储到 cleanup 中
     * 3. 调用回调函数之前，先调用用户注册的过期回调
     * 4. 将 onInvalidate 作为回调函数 cd 的第三个参数，以便用户使用
     */
    let cleanup

    function onInvalidate(fn) {
        cleanup = fn
    }

    const job = () => {
        newValue = effectFn()
        // 调用回调函数 cb 之前，先调用过期回调
        cleanup && cleanup()
        // 将 onInvalidate 函数作为回调函数的第三个参数，以便用户使用
        cb(newValue, oldValue, onInvalidate)
        oldValue = newValue
    }

    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler: () => {
                // 在调度器中判断 flush 是否为 'post'，如果是，则表示调度器函数需要将副作用函数放到微任务队列中，并等待 DOM 更新结束后再执行
                if (options.flush === 'post') {
                    const p = Promise.resolve()
                    // 将 job 函数放进微任务队列中，实现异步延迟执行
                    p.then(job)
                } else {
                    // 直接执行 job 函数，本质上相当于 'sync' 的实现机制，即同步执行
                    job()
                }
            }
        }
    )
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


// 测试验证 --- ？？？？？
watch(() => obj.foo, (newVal, oldVal, onInvalidate) => {
    let expired = false
    onInvalidate(() => {
        expired = true
    })

    let res
    setTimeout(() => { res = `${expired}结果` }, 5000)

    if (!expired) {
        console.log('res', res)
    }
}, {})

setTimeout(() => {
    obj.foo++
}, 2000)


setTimeout(() => {
    obj.foo++
}, 3000)
