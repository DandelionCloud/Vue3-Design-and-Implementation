/**
 * 【第八章 挂载和更新】
 * [8.3 正确的设置元素属性]
 * 
 * ===> 渲染器的核心功能：挂载和更新
 * 
 * 1. 优先设置 DOM Properties
 * 2. 当值为空字符串时，手动矫正为 true
 * 3. 只读 DOM Properties，只能通过 setAttribute 函数来设置
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
                 * 1. setAttribute 函数：element.setAttribute(propName, propValue) ===> 值被字符串化
                 * 2. 直接通过 DOM 对象设置：element[propName] = propValue
                 * 
                 * 【优先设置 DOM Properties，当值为空字符串时，手动矫正为 true】
                 * 1. 如果属性存在对应的 DOM Properties，则优先设置 DOM Properties
                 * 2. 如果属性不具有对应的 DOM Properties，则使用 setAttribute 函数设置
                 * 3. 使用 shouldSetAsProps 函数判断是否应该作为 DOM Properties 设置
                 * 
                 */
                const value = vnode.props[key]
                if (shouldSetAsProps(el, key, value)) {
                    const type = typeof el[key]
                    // 布尔类型的属性，矫正空字符串为 true 
                    if (type === 'boolean' && value === '') {
                        el[key] = true
                    } else {
                        el[key] = value
                    }
                } else {
                    el.setAttribute(key, vnode.props[key])
                }
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

/**
 * shouldSetAsProps 函数，判断是否应该作为 DOM Properties 设置
 * @param {*} el DOM 元素
 * @param {*} key 属性名
 * @param {*} value 属性值
 * @returns 
 * 1. 特殊处理具有 form 属性的表单元素，只能用 setAttribute 函数设置
 * 2. 兜底使用 DOM Properties 设置
 */
function shouldSetAsProps(el, key, value) {
    if (key === 'form') return false
    return key in el
}







/////////////////// 测试 /////////////////////

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