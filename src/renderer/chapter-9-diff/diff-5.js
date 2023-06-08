/**
 * 【第 9 章 简单 Diff 算法】
 * [9.5 添加新元素]
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
 * 
 * 问题一：如何确定存在可复用的节点？
 * 解决：
 * 1. 引入额外的 key 来作为 vnode 的标识
 * 2. 如果新旧子节点的 type 与 key 属性值都相同，则说明节点可复用
 * 
 * 注意：DOM 可复用并不意味着不需要更新，可复用的节点仍需要进行打补丁操作
 * 
 * 问题二：如何判断一个节点是否需要移动？
 * 解决：
 * 1. 最大索引值 lastIndex：在旧 children 中找相同 key 值节点的过程中，遇到的最大索引值
 * 2. 后续找寻过程中，遇到索引值比当前最大索引值小的节点，需要移动
 * 
 * 问题三：如何移动节点？
 * 注意：
 * 1. 移动的是虚拟节点对应的真实 DOM 节点
 * 2. 真实 DOM 节点存储在 vnode.el 属性中
 * 分析：
 * 1. patchElement 函数中，const el = n2.el = n1.el 该语句就是 DOM 元素的复用
 * 解决：
 * 1. 新 children 的顺序就是更新后真实 DOM 节点应有的顺序
 * 2. 小于当前最大索引值，说明旧节点中排在前面，需要排在后面（紧跟前一个节点）
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


    function mountElement(vnode, container, anchor) {
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
        insert(el, container, anchor)
    }

    /**
     * 打补丁（更新操作）
     * @param {*} n1 旧 vnode
     * @param {*} n2 新 vnode
     * @param {*} container 容器
     * @param {*} anchor 锚点（挂载节点时使用）
     * 
     * 1. 新旧 vnode 所描述的内容不同，即 vnode.type 属性值不同 ===> 先卸载 n1，再挂载 n2
     * 2. 卸载完成后，重置旧 vnode n1 为 null，保证后续挂载正确执行
     * 3. 一个 vnode 可以描述的类型有普通标签、组件、Fragment ===> 不同类型的 vnode，提供不同的挂载和打补丁的处理方式
     */
    function patch(n1, n2, container, anchor) {
        // n1、n2 描述内容不同
        if (n1 && n1.type !== n2.type) {
            unmount(n1)
            n1 = null
        }
        const { type } = n2
        // 普通标签元素
        if (typeof type === 'string') {
            if (!n1) {
                mountElement(n2, container, anchor)
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
        /**
         * 1. 将旧节点的 n1.el 属性赋值给新节点 n2.el 属性 ===> DOM 元素的复用
         * 2. 如此，新节点 n2 也将持有对真实 DOM 元素的引用
         */
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
            } ``
            setElementText(container, n2.children)
        }

        // 新子节点是一组子节点
        else if (Array.isArray(n2.children)) {
            if (Array.isArray(n1.children)) {
                /**
                 * 新旧节点都有一组子节点时，使用 Diff 算法更新：
                 * 1. 找到可复用（type 与 key 属性值均相同）的元素，并打补丁 patch
                 * 2. 索引值小于当前最大索引值的节点需要移动
                 * 3. 移动：紧跟前一个节点
                 * 4. 新增节点要挂载
                 */
                const oldChildren = n1.children
                const newChildren = n2.children
                // 用来存储寻找过程中遇到的最大索引值
                let lastIndex = 0
                for (let i = 0; i < newChildren.length; i++) {
                    const newVNode = newChildren[i]
                    // 变量 find，表示是否在旧的一组子节点中找到可复用的节点，默认 false
                    let find = false
                    for (let j = 0; j < oldChildren.length; j++) {
                        const oldVNode = oldChildren[j]
                        // 找可复用的元素，并调用 patch 函数更新
                        if (newVNode.key === oldVNode.key) {
                            find = true
                            patch(oldVNode, newVNode, container)
                            if (j < lastIndex) {
                                /**
                                 * 该节点对应的真实 DOM 元素需要移动:
                                 * 1. 取当前新子节点 newVNode 的前一个节点 prevVNode
                                 * 2. 如果前一个节点不存在，则说明是第一节点，不需要移动
                                 */
                                const prevVNode = newChildren[i - 1]
                                if (prevVNode) {
                                    const anchor = prevVNode.el.nextSibling
                                    /**
                                     * insert 方法：
                                     * 1. 将 newVNode 对应的真实 DOM 插入到锚点元素之前
                                     * 2. 锚点即当前节点的前一个节点对于的真实 DOM 节点 
                                     */
                                    insert(newVNode.el, container, anchor)
                                }
                            } else {
                                lastIndex = j
                            }
                            break
                        }
                    }
                    if (!find) {
                        /**
                         * 1. 没有在旧子节点中找到可复用的节点，说明 newVNode 是新增节点，需要挂载
                         * 2. 挂载到前一个节点对应的真实 DOM 节点的后面，如果没有前一个节点，则挂载到容器头部
                         * 3. 锚点元素为当前节点的前一个节点对应的真实 DOM 节点，或容器元素的 firstChild 
                         */
                        const prevVNode = newChildren[i - 1]
                        let anchor = null
                        if (prevVNode) {
                            anchor = prevVNode.el.nextSibling
                        } else {
                            anchor = container.firstChild
                        }
                        patch(null, newVNode, container, anchor)
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

/**
 * 如下为例说明：
    // oldChildren
    [
        { type: 'p' },
        { type: 'div' },
        { type: 'span' }
    ];
    // new Children
    [
        { type: 'span' },
        { type: 'p' },
        { type: 'div' }
    ]

 * 解析：使用上一节介绍的算法完成上述两组子节点的更新时，需要 6 次 DOM 操作：
 * 1. 比较旧子节点 { type: 'p' } 与新子节点 { type: 'span' }，标签不同，则卸载旧子节点，挂载新子节点 ===> 2 次 DOM 操作
 * 2. 同上，卸载旧子节点 { type: 'div' }，挂载新子节点 { type: 'p' } ===> 2 次 DOM 操作
 * 2. 同上，卸载旧子节点 { type: 'span' }，挂载新子节点 { type: 'div' } ===> 2 次 DOM 操作
 * 
 * 结论：新旧子节点仅仅是顺序不同，通过 DOM 移动来完成更新，性能更优
 * 
 * 问题：如何确定存在可复用的节点？
 */

/**
 * 如下为例说明：
    // oldChildren 
    [
        { type: 'p', children: '1' },
        { type: 'p', children: '2' },
        { type: 'p', children: '3' }
    ];
    // newChildren 
    [
        { type: 'p', children: '3' },
        { type: 'p', children: '1' },
        { type: 'p', children: '2' }
    ]

 * 确定可复用的节点：仅仅通过 vnode.type 的值相同来判断，无法确定新旧两组子节点的节点的对应关系。
 * 
 * 解决：引入额外的 key 来作为 vnode 的标识，如下：
    // oldChildren 
    [
        { type: 'p', children: '1', key: 1 },
        { type: 'p', children: '2', key: 2 },
        { type: 'p', children: '3', key: 3 }
    ];
    // newChildren 
    [
        { type: 'p', children: '3', key: 3 },
        { type: 'p', children: '1', key: 1 },
        { type: 'p', children: '2', key: 2 }
    ]

 * 解析：
 * 1. 引入 key 作为 vnode 的唯一标识
 * 2. 当两个虚拟节点的 type 与 key 属性值都相同时，则节点相同，即 DOM 可复用
 * 
 * 注意：
 * 1. DOM 可复用并不意味着不需要更新
 * 2. 移动操作前，仍需要对两个虚拟节点进行打补丁操作，因为其文本子节点的内容变了
 */


/////////////////////////////////////////// 测试 ///////////////////////////////////////////////////
const oldVNode = {
    type: 'div',
    children: [
        { type: 'p', children: '1', key: 1 },
        { type: 'p', children: '2', key: 2 },
        { type: 'p', children: 'hello', key: 3 }
    ]
}

const newVNode = {
    type: 'div',
    children: [
        { type: 'p', children: 'world', key: 3 },
        { type: 'p', children: '1', key: 1 },
        { type: 'p', children: '2', key: 2 }
    ]
}

// 首次挂载
renderer.render(oldVNode, document.querySelector('#app'))
setTimeout(() => {
    // 1 秒钟后更新
    renderer.render(newVNode, document.querySelector('#app'))
}, 3000);


/**
 * 解析：
 * 1. 取第一个新子节点 key 为 3，尝试在旧子节点中找到相同 key 值的节点，找到了 oldVNode[2]，调用 patch 打补丁：
 *      patch(oldVNode[2], newVNode[0], container) ===> 文本内容由 hello 变成了 world
 * 2. 取第二个新子节点 key 为 1，尝试在旧子节点中找到相同 key 值的节点，找到了 oldVNode[0], 调用 patch 打补丁：
 *      新旧子节点 newVNode[1] 与 oldVNode[0] 完全相同，不做改变
 * 3. 取第三个新子节点 key 为 2，结果同上。
 */