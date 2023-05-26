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
 * 
 * 抽离浏览器平台特有的 API，并为此提供可配置接口 options
 * ===> 传入不同的配置项，即可完成非浏览器环境下的渲染工作
 */
function createRenderer(options) {
    const {
        createElement,
        insert,
        setElementText
    } = options

    // 在这个作用域内定义的函数都可以访问那些 API
    // 使用从配置项中取得的 API 重新实现 ===> 不再依赖于浏览器的特有 API
    function mountElement(vnode, container) {
        const el = createElement(vnode.type)
        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children)
        }
        insert(el, container)
    }

    function patch(n1, n2, container) {
        if (!n1) {
            mountElement(n2, container)
        } else {
            // ...
        }
    }

    function render(vnode, container) {
        if (vnode) {
            patch(container._vnode, vnode, container)
        } else {
            if (container._vnode) {
                container.innerHTML = ''
            }
        }
        container._vnode = vnode
    }

    function hydrate(vnode, container) {
        // ...
    }
    return {
        render,
        hydrate
    }
}

// 把用于操作 DOM 的 API 封装为一个对象，传递给 createRenderer 函数
const renderer2 = createRenderer({
    createElement(tag) {
        return document.createElement(tag)
    },
    setElementText(el, text) {
        el.textContent = text
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor)
    }
})

// 自定义一个配置项，用来打印渲染器操作流程
const renderer3 = createRenderer({
    createElement(tag) {
        console.log(`创建元素 ${tag}`)
        return { tag }
    },
    setElementText(el, text) {
        console.log(`设置 ${JSON.stringify(el)} 的文本内容：${text}`)
        el.textContent = text
    },
    insert(el, parent, anchor = null) {
        console.log(`将 ${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)} 下`)
        parent.children = el
    }
})
const v_node = {
    type: 'div',
    children: 'hello renderer'
}
const container = {
    type: 'root'
}
renderer3.render(v_node, container)