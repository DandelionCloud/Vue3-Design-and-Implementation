/**
 * 【computed】
 * （lazy 的 effect  +  缓存值）
 * 当前情形：使用 effect 注册副作用函数时，会立即执行传递给他的副作用函数
 * 计算属性特性：
 * 1. 懒计算：只有当访问计算属性的 value 属性时，才会真正执行副作用函数，从而获取执行结果，并将执行结果返回
 * 2. computed 函数的执行，返回一个对象，该对象有一个 value 属性，是一个访问器属性
 * 3. 计算结果的缓存：响应式数据不变时，多次访问计算属性，不应该多次执行副作用函数（应该只有第一次访问时进行真正的计算）
 * 
 * 前情提要：
 * 1. 把传递给 effect 的函数看作一个 getter，getter 函数可以返回任何值
 * 
 * 解析：
 * 1. 当 options.lazy 为 true 时，不立即执行副作用函数
 * 2. 当注册副作用函数时，将副作用函数作为返回值返回，并在该函数中返回真正的副作用函数的执行结果
 * 3. 获取注册函数的返回值，手动调用该函数，获取副作用函数执行结果
 * 
 * 注意：
 * 1. track 函数用来追踪和收集依赖，参数分别为 target（目标对象）、key（目标对象上的属性）
 *  - 存放依赖关系的“桶”这棵树，会增加新的分支，该分支起点为 新的目标对象
 * 2. trigger 函数用来触发副作用函数重新执行，参数分别为 target（目标对象）、key（目标对象上的属性）
 *  - 从上述的依赖关系的“桶”里面，找到对应的一条分支，及其属性的依赖集合（副作用函数集合）并执行
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

// 实验
const sumVal = computed(() => obj.foo + obj.bar)

setTimeout(() => {
    obj.foo++
}, 3000)

/**
 * 当在一个 effect 中读取计算属性的值时，形成了典型的 effect 嵌套
 * 1. 计算属性内部有用自己的 effect（lazy effect），getter 会被作为响应数据的依赖收集起来
 * 2. 把计算属性用于另外一个 effect 时，发生嵌套，外层的 effectF1 不会被内层的 副作用函数（getter）中的响应式数据作为依赖收集
 * 3. 所以，响应性数据变化时，无法触发外层副作用函数 effectF1 重新执行
 * 4. 所以，要为外层的副作用函数 effectFn1 建立新的依赖树，即在 bucket 中增加一条分支
 * 解决：
 * 1. 访问计算属性时，手动调用 track 函数进行追踪
 * 2. 当计算属性依赖的响应式数据变化时，手动调用 trigger 函数触发响应
 */
effect(function effectFn1() {
    /**
     * 当在一个 effect 读取计算属性时，形成了嵌套的 effect，注意里层的 effect 是 lazy 的（不访问不执行）
     * 1. effectFn1 中读取计算属性 sumVal.value ======> computed 中 返回的对象的 get value() 函数
     * 联系图：
     *  响应式数据obj(proxy) ------ computed 的 getter 
     *  getter 的返回结果 effectFn ------ computed 的返回值 obj
     *  外层副作用函数 effectFn1 ------ computed 的返回值 obj
     * 串联关系：
     *  响应式数据obj(proxy) ------ getter ------ effectFn ------ computed返回值 obj ------ 外层副作用函数 effectFn1
     * 关键点：computed 的返回值 obj
     */
    console.log('outer effectFn', sumVal.value)
})

/**
 * 输出结果：
    outer effectFn 3
    outer effectFn 4
 */




/**
 * 深度理解：
 * 将外层副作用函数 effectFn1 读取 计算属性的 value 值，看做：
 * 副作用函数 读取 对象 sumVal 的 属性 value，建立联系：effectFn1 - sumVal - value
 * 建立响应式关系（类比 Proxy 代理）：
 * sumVal：
 *  - 属性读取时，追踪和收集依赖    ------  track()
 *  - 属性变化时，触发副作用重新执行    ------  trigger()
 * 
 * 实际运行时，与 computed 的关系：
 *  - 读取时，访问 computed(obj)    ------ get value(){}
 *  - 变化通知，computed(getter)调度器  ------  scheduler(){}
 */