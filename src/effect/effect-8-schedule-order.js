/**
 * 问题：响应系统支持调度-【控制执行顺序】
 * 可调度：当 trigger 动作触发副作用函数重新执行时，有能力决定副作用函数执行的时机、次数、方式。
 * 解决：options.scheduler (trigger 触发副作用重新执行时，调用调度器)
 * 解析：
 *  1. 为 effect 函数增加一个选项参数 options，允许用于指定调度器 scheduler
 *  2. 在 effect 函数内部，把 options 选项挂载到对应的副作用函数上
 *  3. trigger 操作触发副作用函数重新执行时，调用用户传递的调度器函数
 */

// 用一个全局变量存储 当前被激活的 的副作用函数
let activeEffect

// effect 栈
const effectStack = []

// 用于注册副作用函数的 effect 函数
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn)
        // 当 effectFn 执行时，将其设置为当前激活的副作用函数
        activeEffect = effectFn
        effectStack.push(effectFn)
        fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    // 2. 将 options 挂载到 effectFn 上
    effectFn.options = options
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
const data = { foo: 1 }

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
    effectsToRun.forEach(fn => {
        /**
         * 3. 如果一个副作用函数存在调度器，则调用调度器，并将副作用函数作为参数传递给调度器
         * 反之，直接调用副作用函数（保持之前的默认行为）
         */
        if (fn.options.scheduler) {
            fn.options.scheduler(fn)
        } else {
            fn()
        }
    })
}


/**
 * 1. 为 effect 函数增加一个选项参数 option，允许用户指定调度器
 */
effect(
    () => {
        console.log(obj.foo)
    },
    // options
    {
        // 调度器 scheduler 是一个函数
        scheduler(fn) {
            /**
             * 【控制执行顺序】：将副作用函数放到宏任务队列中执行
             */
            setTimeout(fn)
        }
    })

obj.foo++
console.log('执行完了')

/**
 * 输出顺序：
    1
    2
    执行完了
 * 要求调整顺序为：
    1
    执行完了
    2
 */


