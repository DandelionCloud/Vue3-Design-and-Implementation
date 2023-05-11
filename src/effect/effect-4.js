/**
 * 封装 track 和 trigger 函数
 * track函数：追踪和收集依赖
 * trigger函数：触发副作用重新执行
 */

// 用一个全局变量存储被注册的副作用函数
let activeEffect

// effect 用于注册副作用函数
function effect(fn) {
    // 调用 effect 注册副作用函数时，将副作用函数 fn 赋值给 activeEffect
    activeEffect = fn
    // 执行副作用函数
    fn()
}

// 存储副作用函数的桶
const bucket = new WeakMap()

// 原始数据
const data = { text: 'Hello Vue world-4' }

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
}

// 设置函数 set 中调用 trigger() 触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)
    if (!depsMap) { return }
    const effects = depsMap.get(key)
    effects && effects.forEach(fn => fn())
}

effect(
    // 匿名的副作用函数
    () => {
        document.body.innerText = obj.text
    })

setTimeout(() => {
    Object.assign(obj, { text: 'hello effect-4' })
    // obj.text = 'hello effect3'
}, 3000)


/**
 * Uncaught TypeError: 'set' on proxy: trap returned falsish for property 'text' at effect-3.js:72:14
 * 解决：
 * 1. 移除 type="module"
 * 2. 修改属性值使用：obj.text = 'new text'
 */


/**
 * Map 与 WeakMap 的区别
 * - Map：中 key 的引用不会被垃圾回收器从内存中移除
 * - WeakMap：对于 key 是弱引用，一旦 key 被垃圾回收器回收，则对应的键和值就无法访问（从内存中被移除）
 * 
 * 结论：WeakMap 用于存储那些只有当 key 所引用的对象存在时（没有被回收）才有价值的信息
 */

const map = new Map()
const weakmap = new WeakMap()
    // The ECMAScript specification has specific rules for automatic semicolon insertion, however in this case a semicolon isn't automatically inserted because the parenthesised expression that begins on the next line can be interpreted as an argument list for a function call.

    ; (function () {
        const foo = { foo: 1 }
        const bar = { bar: 2 }
        map.set(foo, 1) // foo 作为 map 的 key 被引用，因此垃圾回收器（garbage collector）不会将它从内存中移除
        weakmap.set(bar, 2) // 因为 WeakMap 的 key 是弱引用，不影响垃圾回收器的工作
    })()
console.log('map', map.foo, map.keys())
// console.log('weakmap', bar, weakmap.keys())

