/**
 * 第 13 章 异步组件与函数式组件
 * [13.2 异步组件的实现原理] - 重试机制
 * 具有的能力：
 * 1. 指定 ErrorComponent
 * 2. 指定 Loading 组件，及 delay
 * 3. 指定超时时长
 * 4. 重试
 * 
 * 异步组件：
 * 本质 - 通过封装的手段来实现友好的用户接口，降低用户层面的使用复杂度
 * 
 * 超时与 Error 组件：
 * 1. 指定超时时长，组件加载时间超过指定时长后，出发超时错误，渲染 Error 组件
 * 2. 当错误发生时，将错误对象作为 Error 组件的 props 传递
 *  - 加载过程中 loader() 出现错误
 *  - 加载超时 timeout 出现错误
 * 结果：用户可在自己的 Error 组件中，定义 error 的 props 接收错误对象
 * 
 * 延迟与 Loading 组件：
 * 解释：异步组件的加载过程中，超过指定延迟时间后，加载完成前，显示 Loading 组件
 * 注意：当异步组件加载完成后，会卸载 Loading 组件，因此需要 unmount 函数支持卸载组件
 *  - 增加 typeof vnode.type === 'object' 的判断
 *  - 符合判断时，卸载组件渲染的内容即 subTree ===> 调用 unmount(vnode.component.subTree)
 * 
 * 重试机制：
 * 1. 重试，即当加载出错时，有能力重新发起加载组件的请求。
 * 2. 异步组件加载失败后的重试机制，与请求服务端接口失败后的重试机制一样。
 */

const { onUnmounted } = require('vue')

/**
 * defineAsyncComponent 注册一个异步组件的基本实现
 * @param {*} loader 异步组件的加载器
 * 1. defineAsyncComponent 是一个高阶组件，返回一个包装组件
 */
function defineAsyncComponent(options) {
    // 如果 options 是加载器，格式化为配置项形式
    if (typeof options === 'function') {
        options = {
            loader: options
        }
    }
    const { loader } = options
    let innerComp = null

    // 记录重试次数
    let retries = 0
    /**
     * 封装 load 函数来加载异步组件
     * 1. 捕获加载器错误
     * 2. 如果用户指定了 onError 回调，将控制权交给用户
     */
    function load() {
        return loader().catch(err => {
            if (options.onError) {
                return new Promise((resolve, reject) => {
                    // 重试
                    const retry = () => {
                        resolve(load())
                        retries++
                    }
                    // 失败 
                    const fail = () => reject(err)
                    options.onError(retry, fail, retries)
                })
            } else {
                throw errro
            }
        })
    }

    return {
        name: 'AsyncComponentWrapper',
        setup() {
            const loaded = ref(false)
            const timeout = ref(false)
            const error = shallowRef(null)
            // 标识是否正在加载，默认 false
            const loading = ref(false)

            let loadingTimer = null
            // 如果配置项中指定了 delay，则开启定时器，到延迟时间后，指定为 loading.value 为 true
            if (options.delay) {
                loadingTimer = setTimeout(() => {
                    loading.value = true
                }, options.delay)
            }
            // 如果配置项中没有指定 delay，则直接标记 loading.value 为 true
            else {
                loading.value = true
            }

            // 调用 load 函数加载组件
            load()
                .then(c => {
                    innerComp = c
                    loaded.value = true
                })
                // 增加 catch 语句来捕获加载过程中的错误
                .catch(err => error.value = err)
                // 增加 finally 语句
                .finally(() => {
                    loading.vlaue = false
                    // 论加载成功与否都要清除延迟定时器
                    clearTimeout(loadingTimer)
                })

            let timer = null
            // 如果指定了超时时长，则开启一个定时器计时
            if (options.timeout) {
                timer = setTimeout(() => {
                    // 超时后，标记为超时 timeout 为 true
                    timeout.value = true
                    // 超时后创建一个错误对象，赋值给 error.value
                    error.value = new Error(`Async component timed out after ${options.timeout}ms.`)
                }, options.timeout)
            }
            // 包装组件卸载时要清除定时器
            onUnmounted(() => cleartTimeout(timer))

            const placeholder = { type: Text, children: '' }

            return () => {
                // 加载成功
                if (loaded.value) {
                    return { type: innerComp }
                }
                // 超时且指定 Error 组件
                else if (timeout.value && options.errorComponent) {
                    return { type: errorComponent, props: { error: error.value } }
                }
                // loading 组件
                else if (loading.value && options.loadingComponent) {
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

/**
 * 用户使用：
 *  - loader 加载器
 *  - timeout 超时时长
 *  - errorComponent 出错时渲染的组件
 *  - delay 指定延迟展示 Loading 组件的时间
 *  - loadingComponent 指定 Loading 组件
 */

const AsyncComp = defineAsyncComponent({
    loader: () => import('App.veu'),
    timeout: 2000,  // 超时时长，其单位为 ms
    errorComponent: MyErrorComp,     // 出错时要渲染的组件
    delay: 200,
    loadingComponent: {
        setup() {
            return () => {
                return { type: 'h2', children: 'loading...' }
            }
        }
    }
})

/**
 * 模拟：请求服务端接口失败后的重试
 */
// 模拟接口请求失败
function fetch() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject("err")
        }, 1000)
    })
}

///////////////// 存在疑问！！！ ///////////////
// 封装 load，实现失败后的重试
function load(onError) {
    // 请求接口获得 promise 实例
    const p = fetch()
    // 捕获错误，当错误发生时，返回一个新的 promise 实例，并调用 onError 回调
    return p.catch(err => {
        return new Promise((resolve, reject) => {
            // retry 函数，用来重试
            const retry = () => resolve(load(onError))
            const fail = () => reject(err)
            onError(retry, fail)
        })
    })
}

// 调用 load 函数加载资源
load((retry, fail) => {
    // 失败后重试
    retry()
}).then(res => {
    // 成功
    console.log(res)
})