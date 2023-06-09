/**
 * 【第 9 章 简单 Diff 算法】
 * [9.1 减少 DOM 操作的性能开销]
 * 
 * 【Diff 算法】
 * 当新旧 vnode 的子节点都是一组节点时，为了以最小的性能开销完成更新操作，需要比较两组子节点，用于比较的算法就叫做 Diff 算法。
 * 
 *
 * 注意：
 * 1. 只关心新旧虚拟节点都存在一组子节点的情况
 * 2. 存在于 patchChildren 函数中
 *    render ---> patch/unmount 
 *    patch ---> mountElement/patchElement 
 *    patchElement ---> patchProps/patchChildren
 * 3. 重点请关注 patchChildren 函数的 
        else if (Array.isArray(n2.children)) {
            if (Array.isArray(n1.children)) {
                // Diff 算法核心代码
            }
        }
 */

// createRender 函数，用来创建一个渲染器，其中 options 参数是独立于平台的 API 配置项
function createRenderer(options) {
    const {
        createElement,
        insert,
        setElementText,
        patchProps,
        createText,
        setText
    } = options
    
    const Text = Symbol()   // 文本节点的 type 标识
    const Comment = Symbol()    // 注释节点的 type 标识

    function render(vnode, container) {
        if (vnode) {
            patch(container._vnode, vnode, container)
        } else {
            if (container._vnode) {
                unmount(container._vnode)
            }
        }
        container._vnode = vnode
    }


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

    /**
     * 打补丁（更新操作）
     * @param {*} n1 旧 vnode
     * @param {*} n2 新 vnode
     * @param {*} container 容器
     * 
     * 1. 新旧 vnode 所描述的内容不同，即 vnode.type 属性值不同 ===> 先卸载 n1，再挂载 n2
     * 2. 卸载完成后，重置旧 vnode n1 为 null，保证后续挂载正确执行
     * 3. 一个 vnode 可以描述的类型有普通标签、组件、Fragment ===> 不同类型的 vnode，提供不同的挂载和打补丁的处理方式
     */
    function patch(n1, n2, container) {
        // n1、n2 描述内容不同
        if (n1 && n1.type !== n2.type) {
            unmount(n1)
            n1 = null
        }
        const { type } = n2
        // 普通标签元素
        if (typeof type === 'string') {
            if (!n1) {
                mountElement(n2, container)
            } else {
                patchElement(n1, n2)
            }
        }
        // 文本节点
        else if (type === Text) {
            if (!n1) {
                // 如果没有旧节点，直接创建文本节点并挂载
                const el = n2.el = createText(n2.children)
                insert(el, contaienr)
            } else {
                // 如果有旧节点，更新文本节点内容
                const el = n1.el = n2.el
                if (n2.children !== n1.children) {
                    setText(el, n2.children)
                }
            }
        }
        // 注释节点
        else if (type === Comment) {
            // ...
        }
        // Fragment
        else if (type === Fragment) {
            if (!n1) {
                // 如果旧节点在不存在，逐个挂载Fragment 的 children
                n2.children.forEach(child => patch(null, child, container))
            } else {
                // 如果旧节点存在，则更新 Fragment 的 children 
                patchChildren(n1, n2, container)
            }
        }
        // 组件
        else if (typeof type === 'object') {
            // ...
        }
        // 其他类型
        else if (typeof type === 'xxx') {
            // ...
        }
    }

    /**
     * 更新节点，使用新旧虚拟节点对真实元素进行更新
     * @param {*} n1 旧节点
     * @param {*} n2 新节点
     */
    function patchElement(n1, n2) {
        const el = n2.el = n1.el
        const oldProps = n1.props
        const newProps = n2.props
        // 更新 props 
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key])
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProps(el, key, oldProps[key], null)
            }
        }
        // 更新 children
        patchChildren(n1, n2, el)
    }

    /**
     * 更新子节点函数，使用新旧虚拟节点的子节点 children 进行比较更新
     * @param {*} n1 旧节点
     * @param {*} n2 新节点
     * @param {*} container 容器
     * 
     * 判断新节点的子节点类型
     * 1. 文本节点
     * 2. 一组子节点
     * 3. 没有子节点
     */
    function patchChildren(n1, n2, container) {
        // 新子节点是文本节点
        if (typeof n2.children === 'string') {
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child))
            }
            setElementText(container, n2.children)
        }

        // 新子节点是一组子节点
        else if (Array.isArray(n2.children)) {
            if (Array.isArray(n1.children)) {
                /**
                 * 新旧节点都有一组子节点时，使用 Diff 算法更新：
                 * 1. 遍历长度较短的那一组子节点，调用 patch 进行更新
                 * 2. 如果新子节点更长，则挂载；如果旧子节点更长，则卸载
                 */
                const oldChildren = n1.children
                const newChildren = n2.children
                const oldLen = oldChildren.length
                const newLen = newChildren.length
                // 两组子节点的公共长度
                const commonLength = Math.min(oldLen, newLen)

                for (let i = 0; i < commonLength; i++) {
                    patch(oldChildren[i], newChildren[i], container)
                }
                // 新的一组子节点数量更多，有新子节点需要挂载
                if (newLen > oldLen) {
                    for (let i = commonLength; i < newLen; i++) {
                        patch(null, newChildren[i], container)
                    }
                }
                // 旧的一组子节点数量更多，有旧子节点需要卸载
                else if (oldLen > newLen) {
                    for (let i = commonLength; i < oldLen; i++) {
                        unmount(oldChildren[i])
                    }
                }  
            } else {
                setElementText(container, '')
                n2.children.forEach(child => patch(null, child, container))
            }
        } else {
            // 没有新子节点
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child))
            } else if (typeof n1.children === 'string') {
                setElementText(container, '')
            }
        }
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
 * 
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
 * 
 * 1. 根据 vnode 获取要卸载的真实 DOM 元素
 * 2. 获取 el 的父元素
 * 3. 在父元素上调用 removeChild 移除元素
 * 
 * 好处：
 * 1. 可调用绑定在 DOM 元素上的指令钩子函数
 * 2. 可调用组件相关的生命周期函数，如 beforeUnmount, unmounted
 */
function unmount(vnode) {
    // 如果类型是 Fragment，则只需要处理其 children 即可
    if (vnode.type === Fragment) {
        vnode.children.forEach(child => unmount(child))
        return
    }
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
    // 创建文本节点
    createText(text) {
        return document.createTextNode(text)
    },
    // 设置节点的文本内容
    setText(el, text) {
        el.nodeValue = text
    },
    // 将属性设置的相关操作封装到 patchProps 函数中，作为渲染器选项传递
    patchProps(el, key, prevValue, nextValue) {
        if (/^on/.test(key)) {
            const invokers = el._vei || (el.vei = {})
            //  根据事件名获取伪造的事件处理函数 invoker
            let invoker = invokers[key]
            const name = key.slice(2).toLowerCase()
            if (nextValue) {
                if (!invoker) {
                    // 首次创建、缓存、赋值、绑定
                    invoker = el._vei[key] = (e) => {
                        /**
                         * 1. e.timeStamp 事件发生时间
                         * 2. 屏蔽绑定时间晚于事件发生时间的事件处理函数
                         */
                        if (e.timeStamp < invoker.attached) return
                        if (Array.isArray(invoker.value)) {
                            invoker.value.forEach(fn => fn(e))
                        } else {
                            invoker.value(e)
                        }
                    }
                    invoker.value = nextValue
                    // 存储事件绑定时间
                    invoker.attached = performance.now()
                    el.addEventListener(name, invoker)
                } else {
                    // 更新
                    invoker.value = nextValue
                }
            } else if (invoker) {
                // 移除事件
                el.removeEventListener(name, invoker)
            }
        }
        // 对 class 进行特殊处理
        else if (key === 'class') {
            el.className = nextValue || ''
        }
        // 对 style 进行特殊处理
        else if (key === 'style') {
            // ...
        }
        // 处理正常属性
        else if (shouldSetAsProps(el, key, nextValue)) {
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


/////////////////////////////////////////// 推理 ///////////////////////////////////////////////////

const oldVNode = {
    type: 'div',
    children: [
        { type: 'p', children: '1' },
        { type: 'p', children: '2' },
        { type: 'p', children: '3' },
    ]
}
const newVNode = {
    type: 'div',
    children: [
        { type: 'p', children: '4' },
        { type: 'p', children: '5' },
        { type: 'p', children: '6' },
    ]
}

/**
 * 解析：此时的新旧节点的子节点类型相同，且仅有 children 不一样，可直接遍历更新：
    else if (Array.isArray(n2.children)) {
        if (Array.isArray(n1.children)) {
            const oldChildren = n1.children
            const newChildren = n2.children
            for (let i = 0; i < oldChildren.length; i++) {
                // 调用 patch 函数逐个更新子节点
                patch(oldChildren[i], newChildren[i], container)
            }
        }
    }
 */

const oldVNode2 = {
    type: 'div',
    children: [
        { type: 'p', children: '1' },
        { type: 'p', children: '2' },
        { type: 'p', children: '3' },
    ]
}
const newVNode2 = {
    type: 'div',
    children: [
        { type: 'p', children: '4' },
        { type: 'p', children: '5' },
        { type: 'p', children: '6' },
        { type: 'p', children: '7' },
    ]
}

/**
 * 问题：新旧两组子节点的数量可能不同
 * 解决：
    1. 遍历其中长度较短的一组
    2. 如果新的一组子节点的数量多，则要挂载 mount 新子节点
    3. 如果旧的一组子节点的数量多，则要卸载 unmount 旧子节点
 */