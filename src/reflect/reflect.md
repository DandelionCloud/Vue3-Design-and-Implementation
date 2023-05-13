# 第5章 非原始值的响应式方案

# Proxy
创建一个代理对象，实现对其他对象的代理。即 Proxy 只能拦截一个 `对象` 的 `基本操作`。

- 代理：对一个对象基本语义的代理。它允许我们 **拦截** 并 **重新定义** 对一个对象的基本操作。
- 基本操作：类似这种读取、设置属性值、调用函数等操作，基本语义的操作 
- 非基本操作（复合操作）：如 obj.fn() 是由两个基本语义组成（get + apply）


## 使用
```js
const p = new Proxy(data, {
    // 拦截读取属性操作
    get() {},
    // 拦截读取属性操作
    set() {},
    // 拦截函数调用
    apply(target, thisArg, argArray) {
        target.call(thisArg, ...argArray)
    }
})
```
上述中，Proxy 构造函数接受两个参数：
- 参数一：data 是被代理的原始对象
- 参数二：是一个对象，这个对象是一组夹子（trap），其中 get 函数拦截读取操作，set 函数拦截设置操作

> 注意：此时的拦截操作都在原始对象 target 上完成，即被代理的对象 data 也会随之变化。


***



# Reflect

是一个全局变量，其下的方法与 Proxy 拦截器的方法一致，

任何在 Proxy 拦截器中能找到的方法，都能够在 Reflect 中找到同名函数，如：
```js
const obj = { foo: 1 }
// 以下两种读取等价
console.log(obj.foo)
console.log(Reflect.get(obj, 'foo'))
```

## 使用
Reflect 可以接受三个参数，第三个参数指定接受者 receiver，即函数调用中的 this，如下：
```js
cosnt obj = { foo: 1 }
console.log(Reflect.get(obj, 'foo', { foo: 2 })) // 输出结果为 2
```

回顾此前响应式数据的实现（可查看 Proxy 的使用），在 get 和 set 的拦截函数中，我们都是直接使用原始对象 target 来完成对属性的读取和拦截操作，原始对象 target 即被代理的对象 data。


## 验证一个问题：【由原型引起的多次响应】
```js
function reactive(obj) {
    return new Proxy(obj, {
        // 省略 trap
    })
}

const obj = {}
const proto = { bar: 1 }
const child = reactive(obj)
const parent = reactive(proto)
// 使用 parent 作为 child 的原型
Object.setPrototypeOf(child, parent)
```

设置 child.bar 的值时，执行代理对象 child 的set 拦截函数：
```js
// child 的 set 拦截函数
set(target, key, newVal, receiver){
    // target: 是原始对象 obj
    // receiver: 是代理对象 child
}
```
由于 obj 上不存在 bar 属性，所以取得其原型 parent，并执行代理对象 parent 的 set 拦截函数：
```js
// parent 的 set 拦截函数
set(target, key, newVal, receiver){
    // target: 是原始对象 proto
    // receiver: 是代理对象 child
}
```

发现：代理对象 parent 的 set 拦截函数中。

得到 target 与 receiver 的区别：在最初设置 child.bar 的值的时候，就已经固定不论在任何情况下 receiver 是 child，而 target 是变化的。



## **绝妙**-待探讨！！！：
```js
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
        // 比较新值与旧值，只有当它们不全等，且不都是 NaN 的时候才触发响应（NaN !== NaN）
        if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
            trigger(target, key, type)
        }
    }
    return res
},
```