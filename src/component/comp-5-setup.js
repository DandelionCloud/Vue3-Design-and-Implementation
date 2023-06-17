/**
 * 第 12 章 组件的实现原理
 * [12.5 setup 函数的作用与实现]
 * 
 * 有状态组件：
 * - 从用户角度来看，就是一个选项对象
 * - 从渲染器的内部实现来看，则是一个特殊类型的虚拟节点，vnode.type 存储组件的选项对象
 * 
 * 组件接口：
 * 1. 渲染函数 render 其返回值必须是虚拟 DOM（必须）
 * 2. 自身的状态：data 函数来定义（同时在渲染函数中，可以通过 this 访问该函数返回的状态数据）
 * 3. 接受的数据：通过props 显式地指定组件接受哪些 props 数据（同时在渲染函数中，可以通过 this 访问该函数的 props 数据）
 *    - vnode.props 是为组件传递的 props 数据
 *    - MyComponent.props 是组件选项中定义的 props 选项
 *
 * 组件实例 instance：
 * 1. 维护组件运行过程中的所有信息：
 *  - 生命周期函数
 *  - 渲染的子树 subTree
 *  - 是否已经被挂载
 *  - 自身的状态 data
 * 2. 本质上：是一个状态集合（一个对象）
 * 
 * props 数据：本质上是父组件的数据，当 props发生变化时，会触发父组件重新渲染
 * 1. 子组件的被动更新：由父组件自更新引起的子组件的更新
 * 2. 渲染函数中可通过 this 访问 props 数据 ===> 封装一个上下文对象
 * 
 * 【渲染上下文对象】
 * 1. 本质上是组件实例 instance 的代理
 *  - 作用：拦截数据状态的读取和设置操作
 *  - this 指向：作为渲染函数和生命周期钩子的 this 值
 * 2. 读取顺序：
 *  - 优先从自身状态中进行读写
 *  - props 不可进行写操作
 * 3. 完整的组件包括：组件自身的数据、props 数据、methods、computed 等选项中定义的数据和方法，这些内容都应该在渲染上下文对象中处理
 * 
 * 【setup 函数】
 * 1. 主要用于配合组合式API，为用户提供一个地方来建立组合逻辑、创建响应式数据、创建通用函数、注册声明周期钩子等能力。
 * 2. 在组件的整个生命周期中，setup 函数只会在挂载时执行一次。
 * 3. 返回值情况：
 *  - 函数，将作为组件的 render 函数
 *  - 对象，包含的数据将要暴露给模板使用
 * 4. 接收两个参数：
 *  - 第一个参数：外部为组件传递的 props 数据对象
 *  - 第二个参数：setupContext 对象，其中包含与组件接口相关的数据和方法：
 *      - slots：组件接收到的插槽
 *      - emit：一个函数，用来发射自定义事件
 *      - attrs：为组件传递的，没有在组件显式声明为 props 的属性
 *      - expose：一个函数，用来显式地对外暴露组件数据
 */
import { effect, reactive, shallowReactive, shallowReadonly } from '@vue/reactivity'

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
    const Fragment = Symbol()

    // 挂载节点
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

    // 激活
    function hydrate(vnode, container) {
        // ...
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
                insert(el, container)
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
        // 组件（vnode.type 的值是选项对象）
        else if (typeof type === 'object') {
            if (!n1) {
                mountComponent(n2, container, anchor)
            } else {
                patchComponent(n1, n2, anchor)
            }
        }
        // 其他类型
        else if (typeof type === 'xxx') {
            // ...
        }
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
                 * 【双端 Diff 算法】
                 * 封装 patchKeyedChildren 函数
                 */
                patchKeyedChildren(n1, n2, container)
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

    /**
     * patchKeyedChildren 函数，实现 Diff 算法
     * @param {*} n1 旧虚拟节点
     * @param {*} n2 新虚拟节点
     * @param {*} container 容器
     */
    function patchKeyedChildren(n1, n2, container) {
        const oldChildren = n1.children
        const newChildren = n2.children
        /**
         * 处理相同的前置节点：
         * 1. 定义索引 j 指向新旧两组子节点的开头
         * 2. while 循环向后遍历，直到遇到拥有不同 key 值的节点为止
         */
        let j = 0
        let oldVNode = oldChildren[j]
        let newVNode = newChildren[j]
        while (oldVNode.key === newVNode.key) {
            // 调用 patch 函数进行更新
            patch(oldVNode, newVNode, container)
            // 更新索引 j 递增
            j++
            oldVNode = oldChildren[j]
            newVNode = newChildren[j]
        }
        /**
         * 处理相同的后置节点:
         * 1. 因为两组长度不一定相同，定义两个索引 oldEnd 和 newEnd
         * 2. while 循环从后往前遍历，知道遇到拥有不同 key 值的节点为止
         */
        let oldEnd = oldChildren.length - 1
        let newEnd = newChildren.length - 1
        oldVNode = oldChildren[oldEnd]
        newVNode = newChildren[newEnd]
        while (oldVNode.key === newVNode.key) {
            // 调用 patch 函数进行更新
            patch(oldVNode, newVNode, container)
            // 更新索引 oldEnd 和 newEnd 递减
            oldEnd--
            newEnd--
            oldVNode = oldChildren[oldEnd]
            newVNode = newChildren[newEnd]
        }
        /**
         * 新增节点的情况：
         * 1. oldEnd < j ===> 所有旧子节点都处理完了
         * 2. newEnd >= j ===> 新的一组节点中有未被处理的节点，被视为新增节点
         * 3. 新的一组子节点中，在索引值 j-newEnd 之间的节点属于新增节点，要挂载
         */
        if (j > oldEnd && j <= newEnd) {
            // const anchorIndex = newEnd + 1
            // const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
            // 通过旧子节点取 DOM 元素也可以
            const anchor = oldChildren[j].el
            while (j <= newEnd) {
                patch(null, newChildren[j++], container, anchor)
            }
        }
        /**
         * 遗留旧节点的情况：
         * 1. j > newEnd ===> 所有新子节点处理完了
         * 2. j <= oldEnd ===> 旧的一组子节点中有未被处理的节点，需要移除
         * 3. 旧的一组子节点中，在索引值 j-oldEnd 之间的节点需要卸载
         */
        else if (j <= oldEnd && j > newEnd) {
            while (j <= oldEnd) {
                unmount(oldChildren[j++])
            }
        }
        /**
         * 处理非理想情况：
         * j <= newEnd && j <= oldEnd
         * source 数组：
         * 1. 长度等于新的一组子节点经过预处理之后剩余未处理的节点数量
         * 2. 存储上述新子节点在旧子节点中为位置索引，初始为 -1
         * 3. 用来计算一个最长递增子序列，用于辅助完成 DOM 的移动操作
         * 
         * 新的一组子节点的索引表 keyIndex:
         * 1. key - 新的一组子节点中未被处理的节点的 key 值
         * 2. value - 新的一组子节点中为本处理的节点的在新子节点中的位置索引值（newIndex）
         */
        else {
            // 1. 构建 source 数组
            const count = newEnd - j + 1
            const source = new Array(count)
            source.fill(-1)

            // 2. 填充 source
            const oldStart = j
            const newStart = j
            // 构建索引表 keyIndex (key-index)
            const keyIndex = {}
            // 3. 判断节点是否需要移动（思路与简单 Diff 算法一致）
            let moved = false
            let pos = 0
            for (let i = newStart; i <= newEnd; i++) {
                keyIndex[newChildren[i].key] = i
            }
            // 代表更新过的节点数量
            let patched = 0
            // 一层嵌套 ===> 时间复杂度为 O(n)
            for (let i = oldStart; i <= oldEnd; i++) {
                const oldVNode = oldChildren[i]
                // 如果更新过的节点数量小于等于需要更新的节点数量，则执行更新
                if (patched <= count) {
                    const k = keyIndex[oldVNode.key]
                    if (typeof k !== 'undefined') {
                        newVNode = newChildren[k]
                        patch(oldVNode, newVNode, container)
                        source[k - newStart] = i
                        // 没更新一个节点，patched +1
                        patched++
                        // 判断节点是否需要移动
                        // 疑问：此处不应该是使用旧子节点的 oldIndex i 吗 ？？？！！！
                        if (k < pos) {
                            moved = true
                        } else {
                            pos = k
                        }
                    } else {
                        unmount(oldVNode)
                    }
                } else {
                    unmount(oldVNode)
                }
            }

            if (moved) {
                // 计算出最长递增子序列，返回的是位置索引 
                const seq = getSequence(source)
                let s = seq.length - 1
                let i = count - 1
                for (i; i >= 0; i--) {
                    if (source[i] === -1) {
                        // 该节点是全新节点，要挂载  
                        const pos = i + newStart
                        const newVNode = newChildren[pos]
                        const nextPos = pos + 1
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                        patch(null, newVNode, contaienr, anchor)
                    }
                    else if (i !== seq[s]) {
                        // 该节点需要移动
                        const pos = i + newStart
                        const newVNode = newChildren[pos]
                        const nextPos = pos + 1
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                        insert(newVNode.el, contaienr, anchor)
                    } else {
                        // 该节点不需要移动，s 指向下一个位置
                        s--
                    }
                }
            }

        }
    }

    // 组件的挂载
    function mountComponent(vnode, container, anchor) {
        const componentOptions = vnode.type
        // 从组件选项对象中取得组件的生命周期函数
        let { render, data, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated, props: propsOption, setup } = componentOptions
        // 生命周期函数 beforeCreate 调用
        beforeCreate && beforeCreate()

        const state = data ? reactive(data()) : null
        const [props, attrs] = resolveProps(propsOption, vnode.props)
        const instance = {
            state,
            // 将解析出来的 props 数据包装为 shallowReactive 并定义到组件实例上
            props: shallowReactive(props),
            isMounted: false,
            subTree: null
        }

        /**
         * setup 函数的最小实现：
         * 1. setupContext 暂时只有 attrs
         * 2. setup 函数的第一个参数：只读版本的 props，避免用户意外修改 props 的值
         * 3. 判断返回值 setupResult 类型：
         *   - 函数 ===> 将其作为渲染函数 render
         *   - 否则 ===> 将作为数据状态赋值给 setupState
         * 4. 渲染上下文对象中，增加 setupState 的支持
         */
        const setupContext = { attrs }
        const setupResult = setup(shallowReadonly(instance.props), setupContext)
        // setupState 用来存储由 setup 函数返回的数据
        let setupState = null
        if (typeof setupResult === 'function') {
            if (render) {
                console.error('setup 函数返回渲染函数，render选项将被忽略')
            }
            render = setupResult
        } else {
            setupState = setupResult
        }

        // 将组件实例设置到 vnode 上，用于后续更新
        vnode.component = instance

        /**
         * 渲染上下文对象：
         * 1. 本质上是组件实例的代理，拦截数据状态的读取和设置操作
         * 2. 当渲染函数或生命周期钩子中通过 this 来读取数据时：
         *  - 优先从组建的自身状态中读取，如果没有则再从 props 数据中读取，最后从 setupState 中读取
         *  - 渲染上下文对象 renderContext 作为渲染函数和生命周期钩子的 this 值
         * 3. 还应该包括 methods、computed 等选项中定义的数据和方法
         */
        const renderContext = new Proxy(instance, {
            get(t, k, r) {
                const { state, props } = t
                if (state && k in state) {
                    return state[k]
                } else if (props && k in props) {
                    return props[k]
                } else if (setupState && k in setupState) {
                    return setupState[k]
                }
                else {
                    console.error('不存在')
                }
            },
            set(t, k, v, r) {
                const { state, props } = t
                if (state && k in state) {
                    state[k] = v
                } else if (k in props) {
                    console.warn(`Attempting to mutate prop "${k}". Props are readonly.`)
                } else if (setupState && k in setupState) {
                    setupState[k] = v
                } else {
                    console.error('不存在')
                }
            }
        })

        // 生命周期函数 created 调用
        created && created(renderContext)

        effect(() => {
            const subTree = render.call(renderContext, renderContext)
            if (!vnode.isMounted) {
                // 生命周期函数 beforeMount 调用
                beforeMount && beforeMount().call(renderContext)
                patch(null, subTree, container, anchor)
                instance.isMounted = true
                // 生命周期函数 mounted 调用
                mounted && mounted().call(renderContext)
            } else {
                // 生命周期函数 beforeUpdate 调用
                beforeUpdate && beforeUpdate().call(renderContext)
                patch(instance.subTree, subTree, container, anchor)
                // 生命周期函数 updated 调用
                updated && updated().call(renderContext)
            }
            // 更新组件实例的子树
            instance.subTree = subTree
        }, { scheduler: queueJob })
    }

    // 任务缓存队列，用 Set 数据结果自动去重功能
    const queue = new Set()
    // 标示是否正在刷新任务队列
    let isFlushing = false
    // resolve 的 Promise 实例
    const p = Promise.resolve()

    // 调度器的主要函数，用来将一个任务添加到缓冲队列中，并开始刷新队列
    function queueJob(job) {
        queue.add(job)
        if (!isFlushing) {
            isFlushing = true
            p.then(() => {
                try {
                    // 执行任务队列中的任务
                    queue.forEach(job => job())
                } finally {
                    // 重置状态
                    isFlushing = false
                    queue.clear = 0
                }
            })
        }

    }

    /**
     * 解析组件 props 和 attrs 数据
     * @param {*} options 组件定义的可接收的
     * @param {*} propsData 组件接受到的
     * @returns 
     * 1. 没有定义在 MyComponent.props 选项中的 props 数据将存储到 attrs 对象中
     * 2. 上述实现中还需包含默认值、类型校验等内容的处理
     */
    function resolveProps(options, propsData) {
        const props = {}
        const attrs = {}
        for (const key in propsData) {
            if (key in options) {
                props[key] = propsData[key]
            } else {
                attrs[key] = propsData[key]
            }
        }
        return [props, attrs]
    }


    /**
     * 组件的打补丁(父组件自更新引起的子组件的被动更新)
     * @param {*} n1 
     * @param {*} n2 
     * @param {*} anchor 
     * 1. 检测子组件是否真的需要更新，如果需要则更新子组件的 props、slots 等内容（以下是组件被动更新的最小实现）
     * 2. 将组件实例添加到新的组件 vnode 上，即 n2.component = n1.component
     * 3. instance.props 是浅响应的，因此只需要设置 instance.props 对象下的属性值即可触发更新
     */
    function patchComponent(n1, n2, anchor) {
        // 获取旧虚拟节点的组件实例，并实现新旧节点的复用
        const instance = (n2.component = n1.component)
        // 获取当前（更新前）的 props
        const { props } = instance
        if (hasPropsChanged(n1.props, n2.props)) {
            // 获取新的 props 数据
            const [nextProps] = resolveProps(n2.type.props, n2.props)
            // 更新 props 
            for (const k in nextPrpos) {
                props[k] = nextProps[k]
            }
            // 删除不存在的 props 
            for (const k in props) {
                if (!(k in nextProps)) delete props[k]
            }
        }
        // ...省略其他处理，如 attrs
    }

    // 检测新旧组件接受的 props 是否发生变化
    function hasPropsChanged(prevProps, nextProps) {
        const nextKeys = Object.keys(nextProps)
        if (nextKeys.length !== Object.keys(prevProps).length) {
            return true
        }
        for (let i = 0; i < nextKeys.length; i++) {
            const key = nextKeys[i]
            if (nextProps[key] !== prevProps[key]) { return true }
        }
        return false
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

    // 求解给定序列的最长递增子序列的方法（取自 Vue.js3）
    function getSequence(arr) {
        const p = arr.slice()
        const result = [0]
        let i, j, u, v, c
        const len = arr.length
        for (i = 0; i < len; i++) {
            const arrI = arr[i]
            if (arrI !== 0) {
                j = result[result.length - 1]
                if (arr[j] < arrI) {
                    p[i] = j
                    result.push(i)
                    continue
                }
                u = 0
                v = result.length - 1
                while (u < v) {
                    c = ((u + v) / 2) | 0
                    if (arr[result[c]] < arrI) {
                        u = c + 1
                    } else {
                        v = c
                    }
                }
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1]
                    }
                    result[u] = i
                }
            }
        }
        u = result.length
        v = result[u - 1]
        while (u-- > 0) {
            result[u] = v
            v = p[v]
        }
        return result
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


/**
 * MyComponent 是一个组件，它的值是一个选项对象
 * 
 * 1. 必须的接口：渲染函数，其返回值必须是虚拟 DOM
 * 2. 自身的状态：data 函数来定义（同时在渲染函数中，可以通过 this 访问该函数返回的状态数据）
 * 3. 通过 props 显式地指定组件会接受哪些 props 数据
 * 4. setup 函数
 */
// const MyComponent = {
//     setup() {
//         return () => {
//             return {
//                 type: 'div', children: 'this is a child'
//             }
//         }
//     }
// }
// // 该 vnode 用来描述组件，type 属性存储组件的选项对象
// const CompVNode = {
//     type: MyComponent
//     // ...
// }
// // 调用渲染器来渲染组件
// renderer.render(CompVNode, document.querySelector('#app'))

// const MyComponent2 = {
//     setup() {
//         return {
//             count: 1,
//             title: 'this is a setup title'
//         }
//     },
//     render() {
//         return { type: 'div', children: `${this.title}, ${this.count}` }
//     }
// }
// renderer.render({ type: MyComponent2 }, document.querySelector('#app'))

const MyComponent3 = {
    props: { title: String },
    setup(props) {
        return {
            count: 1,
            title: props.title
        }
    },
    render() {
        return { type: 'div', children: `${this.title}, ${this.count}` }
    }
}
renderer.render({ type: MyComponent3, props: { title: 'this is a props title' } }, document.querySelector('#app'))