/**
 * 问题：effect 硬编码
 * 解决：提供一个用于注册副作用函数的机制
 *  - 全局变量 activeEffect 存储被注册的副作用函数
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
const bucket = new Set()

// 原始数据
const data = { text: 'Hello Vue world' }

// 对原始数据的代理
const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
        // 将 activeEffect 中存储的副作用函数收集到“桶”中
        if(activeEffect){
            bucket.add(activeEffect)
        }
        return target[key]
    },
    // 拦截设置操作
    set(target, key, newVal) {
        target[key] = newVal
        bucket.forEach(fn => fn())
        return true
    }
})

effect(
    // 匿名的副作用函数
    () => {
        console.log('effect run')   // 打印 2 次
        document.body.innerText = obj.text
    })

setTimeout(() => {
    // obj.text = 'hello Vue3'
    obj.notExist = 'hello vue3'
}, 1000)