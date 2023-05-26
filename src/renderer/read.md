# 渲染器 renderer

- 渲染器是用来执行渲染任务的，如浏览器平台上，渲染真实的 DOM 元素。
- 框架跨平台能力的关键

## @vue/reactivity 包
 - 提供响应式 API
 - 暴露全局 API 名为 Vuereactivity


## 渲染器的基本概念

- **渲染器** renderer
- 渲染 render
> 渲染器的作用：把虚拟 DOM 渲染为特定平台上的真实元素。
> - 浏览器平台：虚拟 DOM ---> 真实 DOM 元素

- **虚拟 DOM**：virtual DOM 简写 vdom
- 虚拟节点：virtual node 简写 vnode
> 虚拟 DOM 和真实 DOM：结构一样 ===> 树形结构


- **挂载 mount**：渲染器把虚拟 DOM 节点渲染为真实 DOM 节点的过程。
> Vue.js 组件中的 mounted 钩子函数，会在挂载完成时触发。所以 mounted 钩子中可以访问真实的 DOM 元素。

- **挂载点 container**
> 渲染器需要一个挂载点参数，用于指定具体的挂载位置。*挂载点*就是一个 DOM 元素，作为*容器元素*，渲染器会把内容渲染到其中。