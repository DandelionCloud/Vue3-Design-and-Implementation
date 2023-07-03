/**
 * 第 13 章 异步组件与函数式组件
 * [13.3 函数式组件]
 * 
 * 【函数式组件】
 * 本质：普通函数，返回一个 vnode
 * 注意：在 Vue.js3 中使用函数式组件，主要是因为它的简单性，而不是因为它的性能好。
 * 1. 没有自身状态，但是仍然可以接收由外部传入的 props
 */

// 用户接口层面：
function MyFuncComp(props) {
    return { type: 'h1', children: props.title }
}