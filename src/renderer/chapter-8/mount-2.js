/**
 * 【第八章 挂载和更新】
 * [8.2 HTML Attribute 与 DOM Properties]
 * 
 * ===> 渲染器的核心功能：挂载和更新
 * 
 * 
 * 1. HTML Attribute：定义在 HTML 标签上的属性
 *  - 作用：设置与之对应的 DOM Properties 的初始值。
 *  - 关联多个 DOM Properties：value="foo" 同时与 el.value 和 el.defaultValue 关联
 * 
 * 2. DOM Properties：浏览器解析 HTML 代码后，创建的 DOM 元素对象上的属性（properties）
 * 
 * 3. 直接映射：HTML Attribute 与 DOM Properties 具有同名属性（如 id）
 *  - 并不是所有 HTML Attribute 与 DOM Properties 之间都是直接映射的关系。
 * 
 */

///////////////////////////////////////////// 封装 - createRenderer ////////////////////////////////////////////////
/**
 * createRender 函数，用来创建一个渲染器
 * @param {*} options 独立于平台的 API 配置项
 * @returns 
 */
function createRenderer(options) {
    const {
        createElement,
        insert,
        setElementText
    } = options


    function mountElement(vnode, container) {
        const el = createElement(vnode.type)
        // 处理 children
        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children)
        } else if (Array.isArray(vnode.children)) {
            /**
             * vnode 的子节点是数组时：
             * 1. 循环遍历每一个子节点，并调用 patch 函数挂载数组中的虚拟节点
             * 2. 挂载阶段时，没有旧 vnode，patch 函数第一个参数为 null
             * 3. 挂载子节点到刚刚创建的 el 元素上，patch 函数的第三个参数为挂载点
             * patch(null, child, el) 等价于 mountElement(child, el)
             */
            vnode.children.forEach(child => {
                patch(null, child, el)
            })
        }

        // 处理 props
        if (vnode.props) {
            for (const key in vnode.props) {
                /**
                 * 为元素设置属性的方法：
                 * 1. setAttribute 函数：element.setAttribute(propName, propValue)
                 * 2. 直接通过 DOM 对象设置：element[propName] = propValue
                 */
                el.setAttribute(key, vnode.props[key])
                // el[key] = vnode.props[key]
            }
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

const renderer = createRenderer({
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


const vnode = {
    type: 'div',
    // 使用 children 描述元素的子节点
    children: [
        { type: 'p', children: 'Hello' }
    ],
    /**
     * 使用 props 描述一个元素的属性
     * 1. vnode.props 是一个对象：
     *  - 键：属性名
     *  - 值：属性值
     */
    props: {
        id: 'foo'
    }
}

renderer.render(vnode, document.querySelector("#app"))