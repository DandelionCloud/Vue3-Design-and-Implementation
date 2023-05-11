/**
 * 问题：响应系统支持调度-【控制执行次数】
 * 可调度：当 trigger 动作触发副作用函数重新执行时，有能力决定副作用函数执行的时机、次数、方式。
 * 解析：
 *  1. 为 effect 函数增加一个选项参数 options，允许用于指定调度器
 *  2. 在 effect 函数内部，把 options 选项挂载到对应的副作用函数上
 *  3. trigger 操作触发副作用函数重新执行时，调用用户传递的调度器函数
 * 
 * 框架内容：Vue.js 中连续多次修改响应式数据只会触发一次更新！！！
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
    effectFn.deps.lenght = 0
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
 * 【控制执行次数】
 * 1. 使用 new Set() 定义一个任务队列（Set 数据结构具有自动去重能力）
 * 2. 使用 Promise.resolve() 创建一个 promise 实例，用它将一个任务添加到微任务队列
 * 3. 创建一个标识代表是否正在刷新队列
 */
const jobQueue = new Set()
const p = Promise.resolve()
let isFlushing = false

function flushJob() {
    // 如果队列正在刷新，则什么都不做
    /**
     * 解释：
     * 1. 通过 isFlushing 判断是否需要刷新队列，只有当 isFlushing 为 false 时才执行
     * 2. 一旦 flushJob 开始执行，isFlushing 就被设置为 true，即无论调用多少次 flushJob 函数，一个周期内都只会执行一次
     *  注意：
     *      1. flushJob 函数中，通过 p.then 将任务队列的遍历执行 添加到【微任务队列】中
     *      2. 一次事件循环中，会将微任务队列清空
     */
    if (isFlushing) return
    // 设置为 true，代表正在刷新
    isFlushing = true
    // 在微任务队列中刷新 jobQueue 队列
    p.then(() => {
        jobQueue.forEach(job => job())
        console.log('then')
    }).finally(() => {
        // 结束后重置 isFlushing
        isFlushing = false
        console.log('finally')
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
            // setTimeout(fn)

            // 每次调度时，将副作用函数添加到 jobQueue 队列中
            jobQueue.add(fn)
            // 调用 jobQueue 刷新队列
            flushJob()
        }
    })

obj.foo++
obj.foo++
obj.foo++
obj.foo++

/**
 * 输出：
    1
    2
    3
 * 要求调整次数为（省去中间状态）：
    1
    2
 */


/**
 * 前置知识：【同步任务 - 微任务队列 - 宏任务】
 * 1. 一个事件循环中，先执行同步任务，再执行微任务，当微任务队列清空后，执行宏任务队列中的第一个宏任务
 * 2. 宏任务执行时，也可能会产生微任务，当前宏任务执行完后，继续执行微任务，当微任务队列清空后
 * 3. 当微任务队列清空后，继续执行下一个宏任务，以此类推
 * 
 * 连续对 obj.foo 执行两次自增操作，会同步且连续地执行两个 scheduler 调度函数
 * 拆分解释：
 * 1. 执行同步任务：obj.foo++、jobQueue.add()、isFlushing = true(isFlushing 默认为 false，因此可以执行 flushJob 函数)
        注意：此时创建了两个微任务：p.then()、p.finally()，此两个微任务将被添加到微任务队列中，等待执行
 * 2. 继续执行同步任务：obj.foo++、jobQueue.add()
        注意：
         - 此时，isFlushing 为 true，flushJob 函数被 return，不会继续执行
         - jobQueue.add() 被调用了两次添加同一个副作用函数，由于 Set 数据结构的去重能力，最终任务队列 jobQueue 中仅有一项，即当前副作用函数

    ......（多次对 obj.foo 进行自增操作，只会增加同步任务，由于 isFlushing 为 true 就 return 的条件存在，不会增加微任务数量）

 * 3. 同步任务执行结束，开始执行微任务
        微任务队列中，有两个微任务，分别是 p.then() 和 p.finally()
        - p.then() 中遍历执行 jobQueue 中存储的副作用函数，输出一次 obj.foo 的值和 "then"
        - p.finally() 当 p.then() 执行结束后执行，输出一次 "finally"
 */