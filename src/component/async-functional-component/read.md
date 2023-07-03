# 异步组件和函数式组件

组件的两个重要概念：异步组件和函数式组件

# 异步组件

```tip
异步：意思是以 异步 的方式加载并渲染一个组件。
使用场景：代码分割、服务端下发组件
```
使用动态导入语句 `import()` 来加载组件，代码如下：

```js
const loader = () => import('App.vue')
// loader 加载器执行完后返回一个 promise 实例
loader().then(App => {
    createApp(App).mount("#app")
})
```

## 一、异步组件要解决的问题和具有的能力
- 允许用户指定加载出错时要渲染的 *错误组件 `errorComponent`*
- 允许用户设置加载组件的 *超时时长 `timeout`*
- 允许用户指定 *`Loading` 组件*，以及展示该组件的 *延迟时间 `delay`*
- 组件加载失败时，为用户提供 *重试 `retry`* 的能力

### 1、封装 `defineAsyncComponent` 函数

使用 `defineAsyncComponent` 函数来定义异步组件，它自身是一个高阶组件，它的参数和返回值如下：
- 参数：异步组件的加载器 `loader`
    加载器执行后，返回一个 `promise` 实例

- 返回：包装组件
    包装组件根据加载器 `laoder` 的状态来决定要渲染的内容，成功即被加载的组件 `MyComponent`；失败则为空的占位符。

#### 1.1 简单封装
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

#### 1.2 用户使用

使用上述的 `defineAsyncComponent` 函数定义的异步组件，我们可以直接用 `componens` 组件选项来注册，在模版中使用时与普通组件一样，代码如下：

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
        /* 通过 defineAsyncComponent 来定义异步组件 */
        AsyncComp: defineAsyncComponent(() => import('asyncComp.vue'))
    }
}
</script>
```


### 2. 异步组件的能力一：加载失败的处理

用户层面的接口如下：
```js
const AsyncComp = defineAsyncComponent({
    loader: () => import('App.vue'),    //  加载器
    timeout: 2000,  // 超时时长，其单位为 ms
    errorComponent: MyErrorComp     // 出错时要渲染的组件
})
```

其中，用户通过参数 `timeout` 指定组件的加载超时时长，当超过指定时间后，组件加载失败，展示用户指定的错误组件 `errorComponnet`。

注意：组件加载失败包含两种情况：
- 组件加载器执行失败
- 加载超时

#### 2.1 基本实现

为方便书写和管理，为 `defineAsyncComponent` 函数增加选项参数 `options`，然后通过它来获取用户指定参数：
- 加载器 `loader` （必填项）
- 超时时长 `timeout` 
- 加载错误时需要渲染的组件 `errorComponnet`：

代码如下：
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

现在，我们进行组件加载超时的处理，其核心逻辑位于返回的包装组件中，代码如下：
```js
// 定义超时标识，默认 false
const timeout = ref(false)
// ...
// 超时计时器
let timer = null
if(options.timeout) {
    timer = setTimeout(() => {
        timeout.value = true
    }, options.timeout)
}
// 卸载时清除超时定时器
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
注意：此处为标识超时状态，开启了一个定时器，当该组件被卸载时，需要清除这个定时器。通过生命周期函数 `onUnmounted` 来处理。


#### 2.2 错误信息的传递

上文中说到，组件加载错误包含两种情况：一是加载器错误，二是加载超时。所以，此处处理两种情况：

1. 加载器错误

    因为加载的执行会返回一个 `promise` 实例，所以我们可以增加一条 `catch` 语句，来捕获加载过程中的错误。

2. 加载超时

    当加载时间超过用户指定的加载时间后，我们也需要标记为加载失败。此时，生成一条错误信息。

不论是上述哪种情况，我们都可以将错误信息通过 `props` 传递给用户指定的加载错误渲染的组件 `errorComponent`，方便用户实现更细粒度的控制。

代码实现如下：
```js
// 定义 error，当错误发生时，用来存储错误对象
const error = shallowRef(null)

// 1. 加载器错误捕获
loader()
// 为 loader 函数增加 catch 语句，捕获加载过程中的错误
.catch( err => error.value = err )

// 2. 加载超时错误
if(options.timeout) {
    timer = setTimeout(()=>{
        // ...
        // 超时后创建一个错误对象，并赋值给 error.value
        error.value = new Error(`Async component timed out after ${options.timeout}ms.`)
    })
}
```

最后，在满足返回加载错误组件的情况下，为用户指定的错误组件 `errorComponent` 增加名为 `error` 的 `props`：
```js
else if (timeout.value && options.errorComponent) {
    return { type: errorComponent, props: { error: error.value } }
}
```

### 3、异步组件的能力二：延迟加载 Loading 组件

首先设计用户层面的接口，如下：
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
其中，用户通过指定参数 `delay` 和 `loadingComponent` 来指定 loading 组件，以及延迟加载它的延迟时间。

因此，我们也为 `defineAsyncComponent` 函数的 `options` 选项参数增加 `delay` 和 `loadingComponent` 属性字段。处理逻辑位于包装组件中。

实现思路：
- 增加 loading 标识，表示 Loading 组件是否正在加载
- 根据用户指定的延迟时间，增加定时器。当超过延迟时间，标记为正在加载。如果用户没有指定延迟时间，则直接标记为正在加载

代码如下：
```js
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
```

注意：不论加载成功与否，都需要清除 loading 定时器 `loadingTimer`，并重置是否正在加载的标记为否。


最后增加 loading 组件渲染的判断，代码如下；
```js
// 如果正在加载且用户指定了 loading 组件，则渲染 loading 组件
else if (loading.value && options.loadingComponent) {
    return { type: options.loadingComponent }
}
```

注意：当异步组件加载完成后，会卸载 `Loading` 组件并渲染异步加载的组件。因此在卸载组件的函数 `unmount` 中，需要支持组件的卸载。

代码如下：
```js
// 卸载函数
function unmount(vnode) {
    // ...
    else if(typeof vnode.type === 'object') {
        unmount(vnode.component.subTree)
        return
    }
    // ...
}
```

### 4、异步组件的能力三：重试能力

当异步组件加载失败后，我们要支持允许重试。

异步组件加载失败的重试机制，与请求服务端接口失败后的重试一样。

#### 4.1 模拟接口请求失败

我们可以封装一个函数，用来模拟接口请求失败的情况。

代码如下：

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
```
我们使用上述 `fetch` 函数，来模拟发送 `HTTP` 请求，并在 `1` 秒后返回失败。为了实现失败后的重试，我们继续封装一个函数，代码如下：

```js
// 封装一个 load 函数来请求 fetch，接收一个 onError 回调
function load(onError) {
    const p = fetch()
    // 捕获错误，当错误发生时返回一个新的 promise 实例，并调用 onError 回调
    return p.catch(err => {
        return new Promise((resolve, reject) => {
            const retry = () => resolve(load(onError))
            const fail = () => reject(err)
            // 将重试函数 retry 作为参数传递给 onError 函数
            onError(retry, fail)
        })
    })
}
```
其中，封装的 `load` 函数接收一个 `onError` 的回调，我们可以通过这个回调进行加载失败后的进一步处理。

最终用户使用 `load` 函数，实现重试，代码如下：

```js
// 用户通过回调进行重试
load((retry, fail) => {
    retry()
}).then(res=>{
    // 成功
    console.log(res)
})
```

#### 4.2 异步组件的重试实现

根据上述接口请求的重试，我们将其整合到异步组件的加载流程中。

基本思路：加载器 `loader` 就等同于上述的 `fetch` 函数，同样封装一个加载函数 `load`，其中捕获加载器的错误，并返回一个 `promise` 实例，并在返回的这个实例中执行用户指定的回调函数。

代码如下：
```js
// 记录重试次数
let retries = 0
// 封装一个 load 函数，用来加载异步组件
function load(){
    return loader()
    // 捕获加载器的错误
    .catch(err=>{
        if(options.onError) {
            // 如果用户指定了 onError 回调，将控制权交给用户
            // 返回一个新的 promise 实例
            return new Promise((resolve, reject) => {
                const retry = () => {
                    resolve(load())
                    retries++
                }
                const fail = () => reject(err)
                // 将重试函数，失败函数，以及重试次数作为参数传给 onError 回调
                options.onError(retry, fail, retries)
            })
        } else {
            // 如果用户没有指定回调，则直接抛出错误信息
            throw error
        }
    })
}
// ...
// setup 中调用 load 函数，而不是加载器
load().then(
    // ...
).catch(
    // ...
).finally(
    // ...
)
```

最后，代码整合：
```js
function defineAsyncComponent(options){
    // 如果 options 是加载器，格式化为配置项形式
    if(typeof options === 'function') {
        options = {
            loader: options
        }
    }
    const { loader } = options
    let InnerComp = null

    // 记录重试次数
    let retries = 0
    // 封装 load 函数，用来加载异步组件，并提供加载失败后的重试能力
    function load() {
        return loader().catch(err => {
            if(options.onError) {
                return new Promise((resolve, reject) => {
                    const retry = () => {
                        resolve(load())
                        retries++
                    }
                    const fail = () => reject(err)
                    options.onError(retry, fail, retries)
                })
            } else {
                throw error
            }
        })
    }

    return {
        name: "AsyncComponentWrapper",
        setup() {
            // 是否加载成功
            const loaded = ref(false)
            // 是否超时，默认 false
            const timeout = ref(false)
            // 加载错误后，存储错误对象
            const error = shallowRef(null)
            // 是否正在加载
            const loading = ref(false)

            let loadingTimer = null
            // 如果用户指定了延迟时间，开始 loading 的延迟定时器
            if(options.delay) {
                loadingTimer = setTimeout(() => {
                    // 到达指定延迟时间后，标记 loading
                    loading.value = true
                }, options.delay)
            } 
            // 如果用户没有指定延迟时间，则直接标记 loading
            else {
                loading.value = true
            }

            // 调用 load 函数加载异步组件
            load()
                // 加载成功
                .then(c => {
                    InnerComp = c
                    loaded.value = true
                })
                // 加载失败
                .catch(err => {
                    error.value = err
                })
                // 清理 loading 组件的延时定时器
                .finally(() => {
                    loading.value = false
                    clearTimeout(loadingTimer)
                })

            // 加载超时
            let timer = null
            // 如果用户指定了超时时长，则开始超时定时器
            if(options.timeout) {
                timer = setTimeout(() => {
                    // 到达指定超时时长后，标记为超时
                    timeout.value = true
                    // 加载超时后，创建一个错误对象，将错误信息传递给 errorComponent 组件
                    error.value = new Error(`Async component timed out after ${options.timeout}ms.`)
                }, options.timeout)
            }

            // 包装组件卸载时，要清理加载超时的定时器
            onUnmounted(() => clearTimeout(timer))

            // 占位符
            const placeholder = { type: Text, children: ''}

            return () => {
                // 成功
                if(loaded.value) {
                    return { type: InnerComp }
                }
                // 失败（超时）
                else if(timeout.value && options.errorComponent) {
                    return { type: errorComponent, props: { error: error.value }}
                }
                // 延迟 loading 组件
                else if(loading.value && options.loadingComponent) {
                    return { type: options.loadingComponent }
                }
                // 默认
                else {
                    return placeholder
                }
            }
        }
    }
}
```

# 函数式组件

使用一个普通函数定义组件，其返回值就是组件要渲染的内容。

特点：无状态、编写简单且直观、无生命周期

```tip  
注意：Vue.js3中使用函数组件是因为它的简单性，而非性能好。因为在 Vue.js3 中，即使是有状态组件，其初始化性能消耗也非常小。
```
函数式组件与有状态组件的实现逻辑是一致的，所以挂载和更新均可复用。

### 1、函数式组件的支持

因为有状态组件与函数式组件都属于组件，所以在是否为组件的判断中，我们要增加对于函数组件的支持，即在 `patch` 函数中，增加是否为函数式组件的判断。

代码如下：

```js
function patch(n1, n2, container, anchor) {
    // ...
    // 有状态组件（type 的值是组件选项对象）
    // 函数式组件（type 的值为函数）
    else if(typeof type === 'object' || typeof type === 'function') {
        if (!n1) {
            mountComponent(n2, container, anchor)
        } else {
            patchComponent(n1, n2, anchor)
        }
    }
}
```

### 2、函数式组件的挂载

不论是有状态组件，还是函数式组件，我们都可以通过 `mountComponent` 函数来完成挂载，通过 `patchComponent` 完成更新。

下面我们修改`mountComponent` 函数，来支持函数式组件的挂载。

代码如下： 
```js
function mountComponent(vnode, container, anchor) {
    // 判断是否为函数式组件
    const isFunctional = typeof vnode.type === 'function'
    const componentOptions = vnode.type
    // 如果是函数式组件，重置其组件选项
    if(isFunctional) {
        componentOptions = {
            render: vnode.type,
            props: vnode.type.props
        }
    }
    // ...
}
```

其中，我们将组件函数直接作为组件选项对象的 `render` 选项，并将组件函数的 *静态 `props` 属性* 作为组件选项对象的 `props` 选项。

总结：对于函数式组件来说，不需初始化 `data` 和生命周期钩子。因此，函数式组件的初始化性能消耗要小于有状态组件。