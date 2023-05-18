/**
 * 等同于 reflect-5-summary.js
 */

// 用一个全局变量存储 当前被激活的 的副作用函数
let activeEffect

// effect 栈
const effectStack = []

function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.deps = []
  effectFn()
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

effect(() => {
  // console.log(obj.foo)
  console.log(obj.foo2)
})

setTimeout(() => {
  // obj.foo = 1
  obj.foo2 = NaN
  console.log('重置')
}, 3000)

/**
 * 解释：
 * 1. set 拦截函数中增加新旧值的判断后，新旧值一致时，不触发副作用函数重新执行
 * 2. 全等判断中无法避免的 NaN 的错误：NaN !== NaN 为 true  ===>  保证新旧值不都是 NaN: oldValue === oldValue || newVal === newVal
 */
