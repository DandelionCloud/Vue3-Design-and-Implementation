# 异步组件和函数式组件

组件的两个重要概念：异步组件和函数式组件

# 异步组件

```tip
异步：意思是以 异步 的方式加载并渲染一个组件。
使用场景：代码分割、服务端下发组件
```
动态倒入语句 import() 可以用来加载组件，并返回一个 promise 实例

```js
const loader = () => import('App.vue')
loader().then(App => {
    createApp(App).mount("#app")
})
```

## 一、异步组件要解决的问题和具有的能力
- 允许用户指定加载出错时要渲染的组件
- 允许用户指定 Loading 组件，以及展示该组件的延迟时间
- 允许用户设置加载组件的超时时长
- 组件加载失败时，为用户提供重试的能力

### 1、封装 `defineAsyncComponent`

使用 `defineAsyncComponent` 函数来定义异步组件，自身是一个高阶组件：
- 参数：异步组件的加载器 `loader`
    加载器执行后，返回一个 `promise` 实例
- 返回：包装组件
    包装组件根据加载器的状态来决定要渲染的内容，成功即被加载的组件；失败则为占位符。


```js
function defineAsyncComponent(loader) {
    // 存储异步加载的组件
    let innerComp = null
    // 返回一个包装组件
    return {
        name: 'AsyncComponentWrapper',
        setup() {
            // 异步组件是否加载成功
            const loaded = ref(false)
            // 加载成功，将加载的组件赋值给 innerComp，并标记 loaded 为 true，表示成功
            loader().then(c => {
                innerComp = c
                loaded.value = true
            })
            return () => {
                return loaded.value ? { type: innerComp } : { type: Text, children: '' }
            }
        }
    }
}
```

使用 `defineAsyncComponent` 定义的异步组件，可以直接使用 `componens` 组件选项来注册，在模版中使用异步组件与普通组件一样：
```js
<template>
    <!-- 同步组件 -->
    <CompA />
    <!-- 异步组件 -->
    <AsyncComp />
</template>

<script>
import { defineAsyncComponent, shallowRef } from 'vue'
import CompA from '../../app.vue'

export default {
    components: {
        CompA,
        // 通过 defineAsyncComponent 来定义异步组件
        AsyncComp: defineAsyncComponent(() => import('asyncComp.vue'))
    }
}
</script>
```


### 2. 提供加载超时及 Error 组件能力

用户使用如下：
```js
const AsyncComp = defineAsyncComponent({
    loader: () => import('App.veu'),    //  加载器
    timeout: 2000,  // 超时时长，其单位为 ms
    errorComponent: MyErrorComp     // 出错时要渲染的组件
})
```

`defineAsyncComponent` 函数需要增加选项参数，可通过 `options` 获取加载器 `loader`、超时时长 `timeout`、Error 组件 `errorComponnet`：
```js
function defineAsyncComponent(options) {
    // 如果 options 是加载器，格式化为配置项形式
    if (typeof options === 'function') {
        options = {
            loader: options
        }
    }
    // 通过选项获取加载器
    const { loader } = options
    // options.timeout
    // options.errorComponent
}
```

超时处理的实现：
```js
// 主要区别在 setup() 中
// 定义超时标识，默认 false
const timeout = ref(false)
// ...
// 计时器
let timer = null
if(options.timeout) {
    timer = setTimeout(() => {
        timeout.value = true
    }, options.timeout)
}
// 卸载时清除定时器
onUnmounted(() => clearTimeout(timer))
// ...
// 增加判断返回
return () => {
    // 加载成功 
    // ...
    // 加载超时且指定了 Error 组件
    if(timeout.value && options.errorComponent) {
        return { type: errorComponent }
    }
    // 占位
    // ...
}
```

同时，为了方便用户实现更细粒度的控制，我们可以将加载错误作为 `Error` 组件的 `props` 传递给用户自定义的 `errorComponent`，代码实现如下：
```js
// 主要代码仍在 setup 函数中
// 定义 error，当错误发生时，用来存储错误对象
const error = shallowRef(null)

// 为 loader 函数增加 catch 语句，捕获加载过程中的错误
loader().then(
    // ...
).catch( err => error.value = err )
```

因为也可能是加载超时产生错误，所以在定时器 `timer` 中，增加错误生成，并赋值给 `error.value` 的操作：
```js
timer = setTimeout(()=>{
    // ...
    const error = new Error(`Async component timed out after ${options.timeout}ms.`)
})
```

最后，在满足返回 Error 组件的情况下，为 `Error` 组件增加 `props`：
```js
else if (timeout.value && options.errorComponent) {
    return { type: errorComponent, props: { error: error.value } }
}
```

3、提供延迟加载 Loading 组件的能力

首先设计用户接口，如下：
```js
const AsyncComp = defineAsyncComponent({
    loader: () => import('App.veu'),    //  加载器  
    delay: 200,
    loadingComponent: {
        setup() {
            return () => {
                return { type: 'h2', children: 'loading...' }
            }
        }
    }
})
```

此时需要为 `defineAsyncComponent` 函数的 `options` 选项参数增加 `delay` 和 `loadingComponent` 属性字段，主要实现如下：
```js
// 核心代码在 setup 函数中
// 增加 loading 标识，代表是否正在加载，默认 false 
const loading = ref(false)
// 增加用于延迟的计时器 loadingTimer
const loadingTimer = null
// 如果用户配置了 delay 参数，则开启定时器，到延迟时间后修改 loading 标识
if (options.delay) {
    loadingTimer = setTimeout(() => {
        loading.value = true
    }, options.delay)
}
// 如果配置项中没有指定 delay，则直接标记 loading.value 为 true
else {
    loading.value = true
}
// 为 loader 函数增加 finally 语句，用户处理结束时的操作
loader.then(
    // ...
).catch(
    // ...
).finally(()=>{
    // 加载完成后，不论是否成功都要清除定时器，且重置 loading.value 为 false
    loading.value = false
    clearTimeout(loadingTimer)
})
// ...
// 增加返回的判断：如果正在加载且用户指定了 loading 组件，则渲染 loading 组件
else if (loading.value && options.loadingComponent) {
    return { type: options.loadingComponent }
}
```

注意：当异步组件加载完成后，会卸载 `Loading` 组件并渲染异步加载的组件。因此需要 `unmount` 函数支持组件的卸载，如下：
```js

function unmount(vnode) {
    // ...
    else if(typeof vnode.type === 'object') {
        unmount(vnode.component.subTree)
        return
    }
    // ...
}
```

4、重试能力
异步组件加载失败的重试机制，与请求服务端接口失败后的重试一样。现模拟接口请求失败的情况，如下
```js
// 封装一个 fetch 函数
function fetch(){
    return new Promise((resolve, reject) => {
        // 1 秒后失败
        setTimeout(() => {
            reject('err')
        }, 1000)
    })
}

// 封装一个 load 函数来请求 fetch，接收一个 onError 回调
function load(onError) {
    const p = fetch()
    // 捕获错误，当错误发生时返回一个 promise 实例，并调用 onError 回调
    return p.catch(err => {
        return new Promise((resolve, reject) => {
            const retry = () => resolve(load(onError))
            const fail = () => reject(err)
            // 将重试函数 retry 作为参数传递给 onError 函数
            onError(retry, fail)
        })
    })
}

// 用户使用时，重试
load((retry, fail) => {
    // 回调中调用重试函数
    retry()
}).then(res=>{
    // 成功
    console.log(res)
})
```

# 函数式组件

```tip  
使用一个普通函数定义组件，其返回值就是组件要渲染的内容。

特点：无状态、编写简单且直观
```