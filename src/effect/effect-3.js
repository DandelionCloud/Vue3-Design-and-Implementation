/**
 * 问题：没有在副作用函数与被操作的目标字段之间建立明确的联系
 * 解决：使用 WeakMap 作为“桶”的数据结构
 * - 原始对象 target 
 *      - 字段名 key
 *          - 副作用函数 effectFn
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
const data = { text: 'Hello Vue world' }

// 对原始数据的代理
const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
        if (!activeEffect) {
            return target[key]
        }
        // 根据 target 从“桶”中取得 depsMap(Map类型：key --> effects)
        let depsMap = bucket.get(target)
        // 如果不存在 depsMap，新建一个 Map 并与 target 关联
        if (!depsMap) {
            bucket.set(target, (depsMap = new Map()))
        }
        // 根据 key 从 depsMap 中取出 deps（Set 类型，包含所有与当前 key 相关联的副作用函数 effects）
        let deps = depsMap.get(key)
        // 如果 deps 不存在，新建一个 Set 并与 key 关联
        if (!deps) {
            depsMap.set(key, (deps = new Set()))
        }
        // 将当前激活的副作用函数添加到“桶”里
        deps.add(activeEffect)
        // 返回属性值
        return target[key]
    },
    // 拦截设置操作
    set(target, key, newVal) {
        // 设置属性值
        target[key] = newVal
        // 根据 target 从桶中取得 depsMap(key --> effects)
        const depsMap = bucket.get(target)
        if (!depsMap) return
        // 根据 key 取得所有副作用函数 effects（key 的依赖集合）
        const effects = depsMap.get(key)
        // 执行副作用函数
        effects && effects.forEach(fn => fn())
        // return true
    }
})

effect(
    // 匿名的副作用函数
    () => {
        document.body.innerText = obj.text
    })

setTimeout(() => {
    Object.assign(obj, { text: 'hello effect-3' })
    // obj.text = 'hello effect3'
}, 3000)


/**
 * Uncaught TypeError: 'set' on proxy: trap returned falsish for property 'text' at effect-3.js:72:14
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
    console.log('weakmap', weakmap.foo, weakmap.keys())

