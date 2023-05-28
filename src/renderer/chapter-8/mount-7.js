/**
 * 【第八章 挂载和更新】
 * [8.7 事件的处理]
 * 
 * 1. 在虚拟节点上描述事件 ===> vnode.props 中以 on 开头的属性视作事件
 * 2. 将事件添加到 DOM 元素上 ===> patchProps 函数中调用 addEventListener
 * 3. 更新事件
 * 法一：移除之前添加，绑定新的到 DOM 元素上
 * 法二：
 *      - 创建伪造事件处理函数 invoker，并缓存到 el.vei 上
 *      - 真正的事件处理函数存储在 invoker.value 上
 *      - 更新事件时，只需要更新 invoker.value 即可
 *      - 仅在需要移除事件时，执行 removeEventListener 函数，提升性能
 *      事件触发 ===> invoker(e) 执行 ===> invoker.value(e) 执行
 * 
 * 问题： el.vei 同一时刻只能缓存一个事件处理函数，当一个元素同时绑定了多种事件，导致事件覆盖
 * 解决：重新设计 el.vei 的数据结构 ===> 对象，键-事件名，值-对应的事件处理函数
 * 
 * 问题： 一个元素可以绑定同类型的多个事件处理函数，这多个事件处理函数可以共存
 * 解决：使用数组描述事件
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
        setElementText,
        patchProps
    } = options


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
     * 打补丁
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
        // n1、n2 描述内容相同 
        const { type } = n2
        // 普通标签元素
        if (typeof type === 'string') {
            if (!n1) {
                mountElement(n2, container)
            } else {
                patchElement(n1, n2)
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
         * 对事件进行特殊处理:
         * 1. 匹配以 on 开头的属性，视为事件
         * 2. 根据属性名获取事件名，如 onClick ---> click
         * 3. 通过 addEventListener 绑定事件，nextValue 为事件处理函数
         * 
         * 更新事件
         * 1. 移除之前添加的事件处理函数
         * 2. 将新的事件处理函数绑定到 DOM 元素上
            const name = key.slice(2).toLowerCase()
            prevValue && el.removeEventListener(name, prevValue)
            el.addEventListener(name, nextValue)
         * 
         * 更新事件（性能更优）
         * 1. 绑定伪造的事件处理函数 invoker
         * 2. 真正的事件处理函数设置为 invoker.value
         * 3. 更新事件时，即可只更新 invoker.value 的值
         * 
         * vei: vue event invoker
         */
        if (/^on/.test(key)) {
            // 定义 el.vei 为一个对象，存储事件名称到事件处理函数的映射
            const invokers = el._vei || (el.vei = {})
            //  根据事件名获取伪造的事件处理函数 invoker
            let invoker = invokers[key]
            const name = key.slice(2).toLowerCase()
            if (nextValue) {
                /**
                 * 1. 没有 invoker ===> 首次添加
                 *  - 创建并存储到 el.vei[key] 中，避免覆盖问题
                 *  - 真正的事件处理函数赋值给 invoker.value
                 *  - 绑定 invoker 作为事件处理函数
                 * 2. 有 invoker 则非首次，更新 invoker.value 的值
                 */
                if (!invoker) {
                    invoker = el._vei[key] = (e) => {
                        // 如果 invoker.value 是数组，则遍历逐个调用事件处理函数
                        if (Array.isArray(invoker.value)) {
                            invoker.value.forEach(fn => fn(e))
                        } else {
                            // 否则直接作为函数调用
                            invoker.value(e)
                        }
                    }
                    invoker.value = nextValue
                    el.addEventListener(name, invoker)
                } else {
                    // 如果 invoker 存在，则意味着更新，只需要更新 invoker.value 的值即可
                    invoker.value = nextValue
                }
            } else if (invoker) {
                // 新的事件绑定函数不存在，且前一次绑定的 invoker 存在，则移除事件
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





/////////////////// 测试 /////////////////////
const vnode1 = {
    type: 'div',
    children: [
        { type: 'p', children: 'Hello' }
    ],
    props: {
        id: 'foo',
        /**
         * 1. 事件可以视为一种特殊的属性
         * 2. 约定以 on 开头的属性视作事件
         */
        onClick: () => {
            alert('clicked')
        }
    }
}
