/**
 * 【原始值的响应式方案】- 响应丢失问题 - toRef
 * 1. 指 Boolean、Number、String、undefined、null、BigInt、Symbol 类型的值。
 * 2. 按值传递
 * 
 * ref 的作用：
 * 1. 原始值的响应式方案
 * 2. 解决响应丢失问题
 * 
 * 响应丢失问题：
 * 1. setup() 中将数据通过展开运算符(...)暴露到模板中
 * 2. 修改响应式数据时，不会触发重新渲染
 */

// 用一个全局变量存储 当前被激活的 的副作用函数
let activeEffect

// effect 栈
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

// 存储副作用函数的“桶”
const bucket = new WeakMap()

const ITERATE_KEY = Symbol()

/**
 * 【自定义 arrayInstrumentations】
 * 1. 先在代理对象中查找，将结果存储到 res 中
 * 2. 再到原始对象（代理对象通过访问 raw 属性获取）上查找
 * 3. 标记是否可以允许追踪
 */
// 代表是否进行追踪。默认值为 true，即允许追踪
let shouldTrack = true
const arrayInstrumentations = {}
    ;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
        const originMethod = Array.prototype[method]
        arrayInstrumentations[method] = function (...args) {
            // this 是代理对象，先在代理对象上查找，将结果存储到 res 中
            let res = originMethod.apply(this, args)
            if (res === false || res === -1) {
                // 如果在代理对象上找不到，则到原始对象上查找，并更新 res 值
                res = originMethod.apply(this.raw, args)
            }
            // 返回最终结果
            return res
        }
    })
    // 重写数组的 push、pop、shift、unshift 以及 splice 方法
    ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
        const originMethod = Array.prototype[method]
        arrayInstrumentations[method] = function (...args) {
            // 在调用原始方法之前，禁止追踪
            shouldTrack = false
            let res = originMethod.apply(this, args)
            // 在调用原始方法之后，恢复原来的行为，即允许追踪
            shouldTrack = true
            return res
        }
    })

/**
 * 封装 createReactive 函数
 * @param {*} obj 原始对象
 * @param {*} isShallow 是否创建浅响应对象或浅只读对象，默认为 false，即创建深响应对象
 * @param {*} isReadonly 是否只读，默认为 false，即非只读
 * @returns 
 */
function createReactive(obj, isShallow = false, isReadonly = false) {
    return new Proxy(obj, {
        // 拦截读取操作
        get(target, key, receiver) {
            if (key === 'raw') {
                return target
            }
            /**
             * 如果操作目标是数组，并且 key 存在于 arrayInstrumentation 上，则返回定义在 arrayInstrumentation 上的值
             */
            if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
                return Reflect.get(arrayInstrumentations, key, receiver)
            }
            /**
             * 1. 非只读时，才需要建立响应联系
             * 2. 不应该在副作用函数与 Symbol.iterator 这类 symbol 值之间建立响应联系
             */
            if (!isReadonly && typeof key !== 'symbol') {
                track(target, key)
            }
            const res = Reflect.get(target, key, receiver)
            if (isShallow) {
                return res
            }
            if (typeof res === 'object' && res !== null) {
                return isReadonly ? readonly(res) : reactive(res)
            }
            return res
        },
        // 拦截设置操作
        set(target, key, newVal, receiver) {
            if (isReadonly) {
                console.warn(`属性 ${key} 是只读的`)
                return true
            }

            const oldValue = target[key]
            /**
             * 1. 如果代理目标是数组，则检查被设置的索引值是否小于数组长度
             * 2. 如果小于数组长度，则为设置 "SET" 操作
             * 3. 否则，则为新增 "ADD" 操作
             */
            const type = Array.isArray(target) ? Number(key) < target.length ? "SET" : "ADD" : Object.prototype.hasOwnProperty.call(target, key) ? "SET" : "ADD"
            const res = Reflect.set(target, key, newVal, receiver)
            if (target === receiver.raw) {
                if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
                    trigger(target, key, type, newVal)
                }
            }
            return res
        },
        // 拦截 in 操作符
        has(target, key) {
            track(target, key)
            return Reflect.has(target, key)
        },
        // 拦截 for...in 循环
        ownKeys(target) {
            /**
             * 结论：属性个数的变化会影响 foo...in 遍历的结果
             * 常规对象：属性个数发生变化（操作类型是 ADD 或者 DELETE ）
             * 数组对象：属性个数发生变化，即数组元素个数 length 发生变化
             * 
             * 1. 操作目标是数组对象，使用 length 属性作为 key 并建立响应联系
             * 2. 操作目标是长队对象，使用 ITERATE_KEY 作为 key 建立响应联系
             * 
             */
            track(target, Array.isArray(target) ? "length" : ITERATE_KEY)
            return Reflect.ownKeys(target)
        },
        // 拦截 delete 操作
        deleteProperty(target, key) {
            if (isReadonly) {
                console.warn(`属性 ${key} 是只读的`)
                return true
            }
            const hadKey = Object.prototype.hasOwnProperty.call(target, key)
            const res = Reflect.deleteProperty(target, key)
            if (res && hadKey) {
                trigger(target, key, "DELETE")
            }
            return res
        }
    })
}

// 拦截函数 get 中调用 track() 追踪变化
function track(target, key) {
    /**
     * 1. 当禁止追踪时，直接返回
     * 2. 当 push 方法间接读取 length 属性时，禁止追踪，length 不与副作用函数建立响应联系
     */
    if (!activeEffect || !shouldTrack) return
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
 * 设置函数 set 中调用 trigger() 触发变化
 * @param {*} target 目标对象
 * @param {*} key 属性名
 * @param {*} type 操作类型
 * @param {*} newVal 新值
 * @returns 
 */
function trigger(target, key, type, newVal) {
    const depsMap = bucket.get(target)
    if (!depsMap) { return }
    const effects = depsMap.get(key)
    const effectsToRun = new Set()
    effects && effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    // 只有当操作类型为 "ADD" 或 'DELETE' 时，才触发与 ITERATE_KEY 相关联的副作用函数重新执行
    if (type === 'ADD' || type === 'DELETE') {
        const iterateEffects = depsMap.get(ITERATE_KEY)
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }
    /**
     * 1. 操作目标是数组对象，且操作类型为 ADD
     *    ADD ===> 新增了数组元素 ===> 隐式地改变了数组的 length 属性值
     * 2. 取出与 length 属性相关联的副作用函数，添加到 effectsToRun 中待执行
     */
    if (type === 'ADD' && Array.isArray(target)) {
        const lengthEffects = depsMap.get('length')
        lengthEffects && lengthEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }
    /**
     * 1. 操作目标是数组对象，且修改了数组的 length 属性
     *    修改数组的 length 属性 ===> 隐式地影响了索引大于等于 length 新值的元素
     * 2. 对于 index >= length 的元素，取出与它们相关的副作用函数，添加到 effectsToRun 中待执行
     */
    if (Array.isArray(target) && key === 'length') {
        depsMap.forEach((effects, key) => {
            if (key >= newVal) {
                effects.forEach(effectFn => {
                    if (effectFn !== activeEffect) {
                        effectsToRun.add(effectFn)
                    }
                })
            }
        })
    }
    effectsToRun.forEach((fn) => {
        if (fn?.options?.scheduler) {
            fn.options?.scheduler(fn)
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

/*************************************** 封装函数 ***************************************/

/** 封装 readonly 函数，创建只读对象 */
function readonly(obj) {
    return createReactive(obj, false, true)
}


/**
 * 封装 reactive 函数，创建深响应式对象
 * 0. 定义一个 Map 实例，存储原始对象到代理对象的映射（obj -> proxy）
 * 1. 优先通过原始对象 obj 寻找之前创建的代理对象
 * 2. 如果找到了直接返回已有代理对象
 * 3. 否则，创建新的代理对象，并存储到 reactiveMap 中
 * 目的：避免为同一个原始对象多次创建代理对象
 */
const reactiveMap = new Map()
function reactive(obj) {
    const existonProxy = reactiveMap.get(obj)
    if (existonProxy) return existonProxy
    const proxy = createReactive(obj)
    reactiveMap.set(obj, proxy)
    return proxy
}


/**
 * 封装 ref 函数，实现原始值的响应式方案
 * 1. 在 ref 函数内部创建包裹对象
 * 2. 将包裹对象变成响应式数据返回
 * 3. 判断数据是不是 ref：使用 Object.defineProperty 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef 值为 true
 *    ===> 标识 wrapper 是一个 ref 数据
 */
function ref(val) {
    const wrapper = {
        value: val
    }
    // 使用 Object.defineProperty 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef 值为 true
    Object.defineProperty(wrapper, '__v_isRef', { value: true })
    return reactive(wrapper)
}


/////////////////////////////////////////////// 响应丢失问题 - 解释 //////////////////////////////////////////////////
// export default {
//     setup() {
//         // 响应式数据
//         const obj = reactive({ foo: 1, bar: 2 })
//         // 1s 后修改响应式数据的值，不会触发重新渲染
//         setTimeout(() => {
//             obj.foo = 100
//         }, 1000)
//         // 将数据暴露到模板中
//         return {
//             ...obj
//         }
//     }
// }
/**
 * 问题：响应丢失
 * 表现：修改响应式数据的值，不会触发重新渲染
 * 原因：展开运算符（...）
    return { ...obj } 等价于：
    return { foo: 1, bar: 2 }
 * 
 * 解析：
 * 1. 返回使用了展开运算符，相当于返回的是一个普通对象
 * 2. 普通对象不具备响应式能力，不会在渲染函数与响应式数据之间建立响应联系
 */


/**
 * 另一种描述方式：
 * 1. 通过 reactive 函数创建一个响应式数据 obj
 * 2. 将响应式数据 obj 展开到一个新的对象 newObj
 * 3. 在副作用函数中通过新的对象 newObj 读取 foo 属性值
 * 4. 修改响应式数据 obj.foo 的值，不会触发响应
 */
const obj = reactive({ foo: 1, bar: 2 })
const newObj = { ...obj }
effect(() => {
    console.log(newObj.foo)
})
obj.foo = 100   // 不会触发响应


/////////////////////////////////////////////// 响应丢失问题 - 解决 //////////////////////////////////////////////////
// 封装一个 toRef 函数，将响应式对象的属性转换为含有一个访问器属性 value 的对象
function toRef(obj, key) {
    const wrapper = {
        get value() {
            return obj[key]
        }
    }
    return wrapper
}

const newObj2 = {
    foo: toRef(obj, 'foo'),
    bar: toRef(obj, 'bar')
}

effect(() => {
    console.log('newObj2-', newObj2.foo.value)
})
// 能够触发响应
obj.foo = 2

/**
 * 问题：toRef 函数返回的数据只读
 */
const refFoo = toRef(obj, 'foo')
// 无效
refFoo.value = 100