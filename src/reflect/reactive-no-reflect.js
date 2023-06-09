/**
 * 【封装 Proxy - reactive】
 * 问题：屏蔽由原型引起的更新
 * 使用没有 Reflect 的方式，验证一个情况：原型的原因，导致设置响应式数据的属性值后，引起了副作用函数的多次执行。
 * 
 * 示例中预期结果：副作用函数应该仅在 child 代理对象的 set 拦截函数中触发响应
 * 
 * 示例的实际情况：副作用函数在 child 和 parent 两个代理对象的 set 拦截函数中都触发重新执行了
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

function reactive(obj) {
    return new Proxy(obj, {
        // 拦截读取操作
        get(target, key, receiver) {
            // 使得代理对象可以通过 raw 属性访问原始数据
            if (key === 'raw') {
                return target
            }
            track(target, key)
            return Reflect.get(target, key, receiver)
        },
        // 拦截设置操作
        set(target, key, newVal, receiver) {
            const oldValue = target[key]
            const type = Object.prototype.hasOwnProperty.call(target, key) ? "SET" : "ADD"
            const res = Reflect.set(target, key, newVal, receiver)
            // target === receiver.raw 说明 receiver 就是 target 的代理对象，仅在此时可以触发响应
            if (target === receiver.raw) {
                if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
                    trigger(target, key, type)
                }
            }
            return res
        },
    })
}

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


/**
 * 计算属性的实现：
 * 1. 读取 value 值时，获取 getter 的结果（lazy）
 * 2. 对 value 进行缓存（dirty、scheduler）
 * 3. 嵌套在另一个 effect 中（手动触发响应）
 *  - 手动收集依赖
 *  - 手动触发副作用函数重新执行
 * 解释：
 * - 存在的依赖树　obj(proxy)-foo-getter
 * - 新建一个依赖树 obj(computed 的返回值)-value-activeEffect(外层副作用函数)
 * - 访问 sumRes.value 时，建立新的联系
 * - 响应式数据obj(proxy)变化时，进入 getter 的调度器 scheduler 中，从新关系中找出副作用函数并执行
 */

function computed(getter) {
    // 用来缓存上一次计算的值
    let value
    // 用来标识是否需要重新计算值，为 true 则表示需要计算
    let dirty = true

    const effectFn = effect(getter, {
        lazy: true,
        // 添加调度器，在调度器中将 dirty 重置为 true，表示需要重新计算
        // 调度器是在响应式数据发生变化时调用
        scheduler() {
            dirty = true
            /**
             * 当计算属性依赖的响应式数变化时，手动调用 trigger 函数触发响应
             * 此时：从“桶”中根据 obj - 'value' 找出依赖集合（副作用函数-外层副作用函数 effectFn1）执行即可
             */
            trigger(obj, 'value')
        }
    })

    const obj = {
        get value() {
            /**
             * 只有“脏”值，才需要重新计算值，并缓存到 value 中
             */
            if (dirty) {
                value = effectFn()
                // 将 dirty 设置为 false，下一次访问直接使用缓存中的值
                dirty = false
            }
            /**
             * 当读取 value 时，手动调用 track 函数进行追踪
             * 读取时，activeEffect 为外层副作用函数 effectFn1
             * 此时，在“桶”中建立了新的依赖关系 obj - 'value' - activeEffect(effectFn1)
             */
            track(obj, 'value')
            return value
        }
    }

    /**
     * 返回一个对象，该对象的 value 属性是一个访问器属性，只有当读取 value 的值时，才会执行 effectFn 并将结果作为返回值返回
     */
    return obj
}

/**
 * 测试 从原型上继承属性的情况
 * 
 */

const obj = {}
const proto = { bar: 1 }
const child = reactive(obj)
const parent = reactive(proto)
// 使用 parent 作为 child 的原型
Object.setPrototypeOf(child, parent)

const equalVal = Object.getPrototypeOf(obj) === Object.getPrototypeOf(child)
const isProto = Object.getPrototypeOf(obj) === parent
const isProtoP = Object.getPrototypeOf(obj) === proto
const textNode = document.createTextNode(`obj 与它的响应式数据 child 的原型${equalVal ? '' : '不'}相同${equalVal && `${isProto && '，同为响应式数据 parent'}`}，${isProtoP ? '' : "不"}是 proto`)
document.body.append(textNode)

effect(() => {
    console.log('child.bar', child.bar)
    return child.bar
})

setTimeout(() => {
    child.bar++

    const efs = bucket.get(obj).get('bar')
    const efs2 = bucket.get(proto).get('bar')

    console.log('efs', efs, efs2)
}, 2000)

/**
 * 输出结果：
 * child.bar 1 true
 * --- 2秒后 ---
 * child.bar 2 true
 * child.bar 2 true
 * 
 * 解析：
 * 1. 读取响应式数据的 bar 属性，child.bar 与副作用建立相应联系
 * 2. 根据 ECMA 规范：如果对象自身不存在该属性，则会获取对象的原型并调用原型的 [[Get]] 方法得到最终结果
 *    child.bar ===> get(): obj.bar ===> parent.bar ===> parent.bar 与副作用建立响应联系
 *    所以，child.bar 和 parent.bar 都与副作用函数建立了响应联系
 * 3. child.bar=2 ===> 触发代理对象 child 的 set 拦截操作 ===> Reflect.set(target, key, newVal, receiver) ===> 引擎会调用 obj 对象部署的内部方法 [[Set]]
 *    根据规范的 10.1.9.2 节可知：如果设置的属性不存在与对象上，则会取得其原型并调用原型的 [[Set]] 方法
 *    即代理对象 parent 的内部方法 [[Set]] ===> 触发代理对象 parent 的拦截操作
 * 4. 所以，读取 child.bar 时，副作用被 child.bar 和 parent.bar 同时收集，修改 child.bar 时，副作用函数被触发重新执行两次
 * 5. set(target, key, newVal, receiver){} 方法中的 target 始终是被代理的原始对象，receiver 是代理对象
 * 6. set 拦截函数中 target 是变化的，而 receiver 则是在设置响应式数据的属性值时就确定的，且不变（检索 reflect.md 文件，查看set拦截函数中 target 与 receiver 的区别）
 *    如：child.bar = 2 语句就固定了 receiver 是 child
 * 7. 解决：只有当 receiver 是 target 的代理对象时才触发响应
 *    
 */

