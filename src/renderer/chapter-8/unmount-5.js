/**
 * 【第八章 挂载和更新】
 * [8.5 卸载操作]
 * 
 * ===> 渲染器的核心功能：挂载和更新
 * 
 * 1. 卸载操作发生在更新阶段，render 函数渲染空内容时
 *    renderer.render(null, container)
 *
 * 注意：
 * 1. 容器的内容可能是组件渲染的，此时需要调用组件的嗯生命周期函数：beforeUnmount、unmounted
 * 2. 容器的内容含有自定义指令，此时要执行对应的指令钩子函数
 * 3. 移除绑定在 DOM 元素上的事件处理函数
 * 
 * 2. 正确卸载方式：根据 vnode 对象获取与其相关联的真实 DOM 元素，使用原生的 DOM 操作方法将该 DOM 元素移除。
 *  - 在 vnode 与真实 DOM 元素之间建立联系
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
        // 在 vnode 与真实 DOM 元素之间建立联系：vnode.el 引用真实的 DOM 元素
        const el = vnode.el = createElement(vnode.type)
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
            // 更新
        }
    }

    function render(vnode, container) {
        if (vnode) {
            patch(container._vnode, vnode, container)
        } else {
            // 没有要渲染的内容，且存在旧 vnode 时，执行卸载
            if (container._vnode) {
                // 调用 unmount 函数卸载 vnode
                unmount(container._vnode)
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

/**
 * 封装 unmount 函数，用来卸载元素
 * @param {*} vnode 虚拟节点
 * @returns 
 * 1. 根据 vnode 获取要卸载的真实 DOM 元素
 * 2. 获取 el 的父元素
 * 3. 在父元素上调用 removeChild 移除元素
 * 
 * 好处：
 * 1. 可调用绑定在 DOM 元素上的指令钩子函数
 * 2. 可调用组件相关的生命周期函数，如 beforeUnmount, unmounted
 */
function unmount(vnode) {
    const parent = vnode.el.parentNode
    if (parent) {
        parent.removeChild(vnode.el)
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