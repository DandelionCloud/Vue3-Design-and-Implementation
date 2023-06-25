/**
 * 第 13 章 异步组件与函数式组件
 * [13.2 异步组件的实现原理] - [封装 defineAsyncComponent 函数]
 * 具有的能力：
 * 1. 指定 ErrorComponent
 * 2. 指定 Loading 组件，及 delay
 * 3. 指定超时时长
 * 4. 重试
 * 
 * 异步组件：
 * 本质 - 通过封装的手段来实现友好的用户接口，降低用户层面的使用复杂度
 */

/**
 * defineAsyncComponent 注册一个异步组件的基本实现
 * @param {*} loader 异步组件的加载器
 * 1. defineAsyncComponent 是一个高阶组件，返回一个包装组件
 */
function defineAsyncComponent(loader) {
    // 存储异步加载的组件
    let innerComp = null
    // 返回一个包装组件
    return {
        name: 'AsyncComponentWrapper',
        setup() {
            // 异步组件是否加载成功
            const loaded = ref(false)
            // 执行加载器，返回一个 promise 实例
            // 加载成功，将加载的组件赋值给 innerComp，并标记 loaded 为 true，表示成功
            loader().then(c => {
                innerComp = c
                loaded.value = true
            })

            /**
             * 包装组件根据加载器的状态来决定渲染什么内容
             * 1. 加载成功，渲染这个被加载的组件
             * 2. 加载失败，渲染一个占位符（通常是一个注释节点）
             */
            return () => {
                return loaded.value ? { type: innerComp } : { type: Text, children: '' }
            }
        }
    }
}