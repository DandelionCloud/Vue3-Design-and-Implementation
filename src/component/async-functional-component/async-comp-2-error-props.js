/**
 * 第 13 章 异步组件与函数式组件
 * [13.2 异步组件的实现原理] - 超时与 Error 组件
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

    return {
        name: 'AsyncComponentWrapper',
        setup() {
            const loaded = ref(false)
            // 是否超时，默认 false
            const timeout = ref(false)
            // 定义 error，当错误发生时，用来存储错误对象
            const error = shallowRef(null)

            loader()
                .then(c => {
                    innerComp = c
                    loaded.value = true
                })
                // 增加 catch 语句来捕获加载过程中的错误
                .catch(err => error.value = err)

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
            onUnmounted(() => clearTimeout(timer))

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
 */

const AsyncComp = defineAsyncComponent({
    loader: () => import('App.veu'),
    timeout: 2000,  // 超时时长，其单位为 ms
    errorComponent: MyErrorComp     // 出错时要渲染的组件
})