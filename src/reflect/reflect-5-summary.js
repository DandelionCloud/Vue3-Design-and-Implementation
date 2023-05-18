/**
 * 前置知识总结：
 * 【读取操作】
 * 1. 访问属性：obj.foo  ===>   get 拦截函数
 * 2. 判断对象或原型上是否存在给定的key：key in obj  ===>  has 拦截函数
 * 3. 使用 for...in 循环遍历对象：for(const key in obj){}  ===>  ownKeys 拦截函数
 *
 * 【设置操作】
 * 1. 设置新属性'ADD' ===>  基本语义 [[Set]]  ===> set 拦截函数
 * 2. 设置已有属性'SET' ===>  基本语义 [[Set]]  ===> set 拦截函数
 *    const type = Object.prototype.hasOwnProperty.call(target, key) ? "SET" : "ADD"
 *
 * 【删除操作】
 * 1. 删除属性：delete obj.foo  ===>  基本语义 [[Delete117]]  ===>  deleteProperty 拦截函数
 * 
 * 
 * 【完善（合理的触发响应）】
 * 1. 设置操作发生，但是没有值发生变化，不需要触发响应
 *    - set 拦截函数中增加新旧值的判断后，新旧值一致时，不触发副作用函数重新执行
 *    - 因为 NaN !== NaN 为 true  ===>  保证新旧值不都是 NaN: oldValue === oldValue || newVal === newVal
 * 2. 从原型上继承属性的情况
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

// 原始数据
const data = {
  foo: 1,
  foo2: NaN,
  get bar() {
    /**
     * 根据 Reflect.get(target, key, receiver) 的第三个参数指明的代理对象，
     * 此处的 this 即 receiver，即代理对象 obj
     * 所以，读取响应式对象的属性，可以建立响应联系
     */
    return this.foo
  },
}

const ITERATE_KEY = Symbol()
// 对原始数据的代理
const obj = new Proxy(data, {
  /**
   * 拦截读取操作，接受第三个参数 receiver
   * receiver: 表示是谁在读取属性值，即代理对象 obj
   * 读取 obj.bar 的值，其中的 obj 就是 receiver
   */
  get(target, key, receiver) {
    track(target, key)
    // return target[key]
    // 使用 Reflect.get 返回读取到的属性值
    return Reflect.get(target, key, receiver)
  },
  // 拦截设置操作
  set(target, key, newVal, receiver) {
    // 先获取旧值
    const oldValue = target[key]
    /**
     * 1. 先判断该属性是新增的属性还是已有的属性：
     *  - 如果是新增属性，则改变了属性数量，会对 for...in 循环产生影响
     *  - 如果是已有属性，设置值不会改变属性数量，不会对 for...in 循环产生影响
     * 2. 所以，操作类型为 "ADD" 时，要触发与 ITERATE_KEY 相关联的副作用函数重新执行
     * 3. 修改属性、添加新属性，其基本语义都是 [[Set]]，所以要做类型区分
     */
    // 如果属性不存在，则说明是在添加属性，否则是设置已有属性
    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? "SET"
      : "ADD"
    const res = Reflect.set(target, key, newVal, receiver)
    // 1. 比较新值与旧值，只有当它们不全等，且不都是 NaN 的时候才触发响应（NaN !== NaN）
    if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
      trigger(target, key, type)
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
     * 将副作用函数与 ITERATE_KEY 关联
     * 1. ownKeys 获取一个对象的所有属于自己的属性，这一操作不与任何具体的键进行绑定
     * 2. 构造唯一的 key(ITERATE_KEY) 作为标识，与副作用函数建立联系
     */
    track(target, ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
  // 拦截 delete 操作
  deleteProperty(target, key) {
    /**
     * 1. 只有当被删除的属性时对象自己的属性，且删除成功才会触发更新
     * 2. 删除属性，会改变属性数量，对 for...in 循环产生影响
     * 3. 所以，操作类型为 "DELETE" 时，也要触发与 ITERATE_KEY 相关联的副作用函数重新执行
     */
    // 检查被操作的属性是否是对象自己的属性
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const res = Reflect.deleteProperty(target, key)
    if (res && hadKey) {
      trigger(target, key, "DELETE")
    }
    return res
  },
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
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

/**
 * 设置函数 set 中调用 trigger() 触发变化
 * @param {*} target 目标对象
 * @param {*} key 属性名
 * @param {*} type 操作类型
 * @returns
 *
 * 只有当属性数量变化时，即操作类型 type 为 'ADD' 或 'DELETE' 时，才会触发与 ITERATE_KEY 相关联的副作用函数重新执行
 */
function trigger(target, key, type) {
  const depsMap = bucket.get(target)
  if (!depsMap) {
    return
  }
  /**
   * 1. 取得与 key 相关联的副作用函数
   * 2. 取得与 ITERATE_KEY 相关联的副作用函数
   */
  const effects = depsMap.get(key)

  const effectsToRun = new Set()
  /**
   * 1. 将与 key 相关联的副作用函数添加到 effectsToRun
   * 2. 将与 ITERATE_KEY 相关联的副作用函数也添加到 effectsToRun
   */
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  // 只有当操作类型为 "ADD" 或 'DELETE' 时，才触发与 ITERATE_KEY 相关联的副作用函数重新执行
  if (type === "ADD" || type === "DELETE") {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn)
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
effect(() => {
  // console.log(obj.foo)
  console.log(obj.foo2)
})

setTimeout(() => {
  // obj.foo = 1
  obj.foo2 = NaN
  console.log('重置')
}, 3000)

