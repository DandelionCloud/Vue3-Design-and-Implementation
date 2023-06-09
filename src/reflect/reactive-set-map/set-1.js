/**
 * 【代理 Set 和 Map】- Set 数据对象的 size、delete()
 * 集合类型：Map/Set 以及 WeakMap/WeakSet
 * 
 * size 分析：
 * 1. 访问响应式数据的 size 属性，触发 get 拦截函数
 * 2. size 属性的正确获取，Set.prototype.size 是访问器属性 + 需要内部槽 [[SetData]]，仅在原始数据对象 Set 数据上才有
 * 3. 修订访问器属性的 getter 函数执行时的 this 指向：指定 Reflect.get() 的第三个参数
 * 
 * delete() 分析：
 * 1. 访问响应式数据的 delete 方法，触发 get 拦截函数
 * 2. p.delete(1) 触发 delete 函数执行 ===> this 始终指向代理对象 p
 * 3. 将 delete 函数与原始数据对象绑定：.bind()
 * 
 * 前置知识：this 的指向在函数执行时确定，指向当前函数执行的上下文对象，即当前函数所属作用域。
 *
 * 两种改变 this 指向的方法：
 * 1. 访问器属性 ===> 修正其 getter 函数执行时的 this 指向 ===> Reflect.get(target, key, receiver) 中 receiver 指定
 * 2. 属性方法(执行时才确定 this 指向)===> 使用 bind 函数 ===> target[key].bind(target)
 * 
 */

let activeEffect
const effectStack = []

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
const ITERATE_KEY = Symbol()

// 自定义数组方法 arrayInstrumentations
let shouldTrack = true
const arrayInstrumentations = {}
  // 重写数组的查找方法
  ;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
    const originMethod = Array.prototype[method]
    arrayInstrumentations[method] = function (...args) {
      let res = originMethod.apply(this, args)
      if (res === false || res === -1) {
        res = originMethod.apply(this.raw, args)
      }
      return res
    }
  })
  // 重写数组的隐式修改数组长度的原型方法
  ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
    const originMethod = Array.prototype[method]
    arrayInstrumentations[method] = function (...args) {
      shouldTrack = false
      let res = originMethod.apply(this, args)
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
    get(target, key, receiver) {
      if (key === 'size') {
        return Reflect.get(target, key, target)
      }
      return target[key].bind(target)
    }
  })
}

// 拦截函数 get 中调用 track() 追踪变化
function track(target, key) {
  // 当禁止追踪时，直接返回
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
  if (type === 'ADD' || type === 'DELETE') {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  // 向数组添加元素时，取出与 length 属性相关联的副作用函数，添加到 effectsToRun 中待执行
  if (type === 'ADD' && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  // 通过 length 属性修改数组长度时，取出索引大于等于 length 新值的关联的副作用函数，添加到 effectsToRun 中待执行
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

///////////////////////////////////////////// 封装函数 ///////////////////////////////////////////

/** 封装 readonly 创建只读对象 */
function readonly(obj) {
  return createReactive(obj, false, true)
}

/** 封装 reactive 创建深响应式对象 */
// 定义一个 Map 实例，存储原始对象到代理对象的映射（obj -> proxy）
const reactiveMap = new Map()

/**
 * 创建深响应式对象
 * @param {*} obj 原始对象
 * @returns 
 * 1. 优先通过原始对象 obj 寻找之前创建的代理对象
 * 2. 如果找到了直接返回已有代理对象
 * 3. 否则，创建新的代理对象，并存储到 reactiveMap 中
 * 
 * 目的：避免为同一个原始对象多次创建代理对象
 */
function reactive(obj) {
  const existonProxy = reactiveMap.get(obj)
  if (existonProxy) return existonProxy

  const proxy = createReactive(obj)
  reactiveMap.set(obj, proxy)

  return proxy
}

//////////////////////////////////////////// 测试 ////////////////////////////////////////////

// 模拟 Proxy 实现代理 Set 的 size 属性和 delete 方法
const s = new Set([1, 2])
const p = new Proxy(s, {
  get(target, key, receiver) {
    // 如果读取的是 size 属性
    if (key === 'size') {
      // 指定第三个参数 receiver 为 原始对象 target
      return Reflect.get(target, key, target)
    }
    /**
     * 1. 将方法与原始数据对象 target 绑定后返回
     * 2. delete 函数的 this 总是指向原始对象
     */
    return target[key].bind(target)
  }
})

// p.size 即访问代理对象的 size 属性，会触发 get 拦截函数
console.log('mock-', p.size)
console.log('mock-', p.delete(1))

/**
 * 访问 size 错误：Uncaught TypeError: Method get Set.prototype.size called on incompatible receiver
 * 分析：
 * 1. size 属性：规范指出 Set.prototype.size 是一个访问器属性
 * 2. 访问 size 属性时，访问器属性的 getter 函数立即执行：可以指定 receiver 来改变 getter 函数执行时的 this 指向
 * 
 * -----------------------------------------------------------
 * 
 * 访问 delete 错误：Uncaught TypeError: Method get Set.prototype.delete called on incompatible receiver 
 * 分析：
 * 1. delete 是一个方法，访问 p.delete 时，方法并没有执行
 * 2. 访问 p.delete(1) 时才执行 ===> this 始终指向代理对象 p
 * 3. 需要将 delete 方法与原始数据对象进行绑定：.bind()
 * 
 */

const p2 = reactive(new Set([1, 2, 4]))

effect(() => {
  console.log('encapsulate-', p2.size)
  console.log('encapsulate-', p2.delete(4))
})
