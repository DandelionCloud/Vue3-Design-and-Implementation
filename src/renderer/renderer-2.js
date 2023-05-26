/**
 * 【渲染器的设计】- 渲染器的基本概念
 * 
 * 1. 渲染器 renderer <===> 渲染 render
 * 2. 渲染器的作用：
 * - render：将虚拟 DOM 渲染成特定平台的真实元素。具有框架跨平台的能力。
 * - hydrate：激活已有的 DOM 元素（同构渲染）
 * - createApp：创建应用
 * 
 * 3. 虚拟 DOM、虚拟节点：vdom 或 vnode
 * 4. 挂载：渲染器把虚拟 DOM 渲染成真实 DOM 的过程
 *  - Vue.js 组件中 mounted 钩子函数会在挂载完成时触发，所以在该钩子函数中可以访问真实的 DOM 元素。
 * 
 * 5. 挂载点：一个 DOM 元素，作为容器元素，渲染器会把内容渲染到其中。
 * 
 */

import { effect, ref } from '@vue/reactivity'

function renderer(domString, container) {
    container.innerHTML = domString
}

// 渲染静态字符串
renderer('<h1>Hello</h1>', document.getElementById('app'))


// 渲染动态拼接的 HTML 内容
let count = 1
renderer(`<h1>${count}</h1>`, document.getElementById('app'))


// 结合响应系统
const count2 = ref(5)
effect(() => {
    renderer(`<h1>${count2.value}</h1>`, document.getElementById('app'))
})

setTimeout(() => { count2.value++ }, 2000)


///////////////////////////////////////////////// 创建渲染器 /////////////////////////////////////////////////////

/**
 * createRender 函数，用来创建一个渲染器
 * 1. render 函数：以 container 为挂载点，将 vnode 渲染为真实的 DOM 元素，并添加到该挂载点下。
 * 2. hydrate 函数：同构渲染中，用来激活已有的 DOM 元素。
 * 3. 在 Vue3.js 中，创建应用的 createApp 函数也是渲染器的一部分。
 */
function createRenderer() {
    // 渲染
    function render(vnode, container) {
        /**
         * 1. 如果新 vnode 存在，则将其与旧 vnode 一起传给 patch 函数，进行打补丁
         * 2. 如果新 vnode 不存在，而旧 vnode 存在，说明是卸载（unmount）操作，清空 container 内的 DOM
         * 3. 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode 
         */
        if (vnode) {
            /**
             * container._vnode: 旧 vnode
             * vnode: 新 vnode
             * container: 容器
             */
            patch(container._vnode, vnode, container)
        } else {
            if (container._vnode) {
                container.innerHTML = ''
            }
        }
        container._vnode = vnode
    }
    // 激活
    function hydrate(vnode, container) {
        // ...
    }
    return {
        render,
        hydrate
    }
}

// 创建一个渲染器
const renderer2 = createRenderer()
/**
 * 调用渲染器的 renderer.render 函数执行渲染
 * 1. 首次调用 renderer.render 函数时，只需要创建新的 DOM 元素，只设计挂载
 * 2. 多次调用 renderer.render 函数，还需要更新，设计挂载和更新
 * - patch：打补丁（更新），使用 newVnode 与 oldVnode 进行比较，找到并更新变更点。
 * - 挂载本身也是一种特殊的打补丁，特殊在于旧的 oldVnode 不存在。
 */
renderer2.render(oldVnode, document.querySelector("#app"))
renderer2.render(newVnode, document.querySelector("#app"))


const renderer3 = createRenderer()
renderer3.render(vnode1, document.querySelector("#app"))
renderer3.render(vnode2, document.querySelector("#app"))
renderer3.render(null, document.querySelector("#app"))

/**
 * 解析：
 * 1. 首次渲染，挂载：
 *  - 新 vnode 为 vnode1 ===> 渲染为真实 DOM
 *  - 旧 vnode(container._vnode) 为 undefined
 *  - vnode1 ===> container._vnode
 * 
 * 2. 第二次渲染，更新：
 *  - 新 vnode 为 vnode2
 *  - 旧 vnode(container._vnode) 为 vnode1
 *  - vnode2 ===> container._vnode
 * 
 * 3. 第三次渲染，卸载：
 *  - 新 vnode 为 null
 *  - 旧 vnode(container._vnode) 为 vnode2
 *  - 此时容器中渲染的是 vnode2 所描述的内容，需要清空容器。
 */