/**
 * 【渲染器的设计】- 自定义渲染器
 * 
 * 可配置的“通用”渲染器 ===> 将虚拟 DOM 渲染到任意目标平台上
 * 
 * 实现跨平台能力：
 * 1. 抽离平台特定的 API
 * 2. 为抽离的 API 提供可配置的接口
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
// setTimeout(() => { count2.value++ }, 2000)


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

/**
 * patch 函数，渲染器的核心入口，承载最重要的渲染逻辑
 * @param {*} n1 旧 vnode
 * @param {*} n2 新 vnode
 * @param {*} container 容器
 * 
 * 1. 如果 n1 不存在，即没有旧 vnode，意味着挂载
 * 2. n1 存在，意味着打补丁
 */
function patch(n1, n2, container) {
    if (!n1) {
        mountElement(n2, container)
    } else {
        // ...
    }
}

/**
 * 挂载函数
 * @param {*} vnode 虚拟节点
 * @param {*} container 容器
 */
function mountElement(vnode, container) {
    const el = document.createElement(vnode.type)
    if (typeof vnode.children === 'string') {
        el.textContent = vnode.children
    }
    container.appendChild(el)
}


const renderer2 = createRenderer()
const v_node = {
    type: 'div',
    children: 'hello renderer'
}
renderer2.render(v_node, document.getElementById('app'))