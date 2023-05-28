/**
 * 【第八章 挂载和更新】
 * [8.4 class 的处理] - Vue.js 对 class 属性做了增强
 * 
 * ===> 渲染器的核心功能：挂载和更新
 * 
 * 【Vue.js 中为元素设置类名方式】：
 * 1. 指定为一个字符串 ===> class="foo bar"
 * 2. 指定为一个对象值 ===> :class="cls"  const cls = { foo: true, bar: false}
 * 3. 包含上述两类的数组 ===> :class="arr"  const arr = ['foo bar', { baz: true }]
 * ===> 在设置元素的 class 之前将值归一化为统一的字符串形式 ===> 封装 normalizeClass 函数
 * 
 * 【浏览器中为元素设置 class 的方法】：
 * 1. setAttribute
 * 2. el.className (性能最优)
 * 3. el.classList
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
        setElementText,
        patchProps
    } = options


    function mountElement(vnode, container) {
        const el = createElement(vnode.type)
        // 处理 children
        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children)
        } else if (Array.isArray(vnode.children)) {
            vnode.children.forEach(child => {
                patch(null, child, el)
            })
        }

        // 处理 props
        if (vnode.props) {
            for (const key in vnode.props) {
                // 使用配置项进行属性设置
                patchProps(el, key, null, vnode.props[key])
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

const renderer = createRenderer({
    createElement(tag) {
        return document.createElement(tag)
    },
    setElementText(el, text) {
        el.textContent = text
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor)
    },
    // 将属性设置的相关操作封装到 patchProps 函数中，作为渲染器选项传递
    patchProps(el, key, prevValue, nextValue) {
        /**
         * 1. 因为 Vue.js 对 class 进行了增强，所以此处对 class 进行特殊处理
         * 2. 使用性能最优的设置方式 el.className
         * 3. 使用 normalizeClass 函数，将值化为统一的字符串形式：normalizeClass(nextValue)
         */
        if (key === 'class') {
            el.className = nextValue || ''
        }
        // Vue.js 对 style 属性也做了增强，也需要对 style 进行特殊处理
        else if (key === 'style') {
            // ...
        } else if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key]
            if (type === 'boolean' && nextValue === '') {
                el[key] = true
            } else {
                el[key] = nextValue
            }
        } else {
            el.setAttribute(key, nextValue)
        }
    }
})





/////////////////// 测试 /////////////////////
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