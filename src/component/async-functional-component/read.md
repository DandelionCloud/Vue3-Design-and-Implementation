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

# 函数式组件

```tip  
使用一个普通函数定义组件，其返回值就是组件要渲染的内容。

特点：无状态、编写简单且直观
```