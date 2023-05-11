const ElementVNode = {
    type: 'div',
    props: {
        id: 'foo'
    },
    children: [
        { type: 'p', children: 'hello' }
    ]
}

function renderElementVNode(vnode) {
    // 取出标签名、标签属性props、子节点
    const { type: tag, props, children } = vnode;
    // 开始标签的头部
    let res = `<${tag}`
    // 处理标签属性
    if (props) {
        for (const k in props) {
            // 以 key="value" 的形式拼接字符串
            res += ` ${k}="${props[k]}"`
        }
    }
    // 开始标签的闭合
    res += '>'

    /**
     * 处理子节点
     * 1. 如果子节点的类型是字符串，则表明是文本内容，直接拼接
     * 2. 如果子节点的类型是数组，则表明是元素节点，递归调用 人的人ElementVNode 函数完成渲染
     */
    if (typeof children === 'string') {
        res += children
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            res += renderElementVNode(child)
        })
    }

    // 标签结束
    res += `</${tag}>`

    return res
}

console.log(renderElementVNode(ElementVNode))