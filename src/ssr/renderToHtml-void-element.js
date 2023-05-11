/**
 * 自闭合标签
 */

import VOID_TAGS from "../component/void-tags";

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
    const { type: tag, props, children } = vnode;
    const isVolidElement = VOID_TAGS.includes(tag)
    let res = `<${tag}`
    if (props) {
        for (const k in props) {
            res += ` ${k}="${props[k]}"`
        }
    }
    /**
     * 如果是 void element，则自闭合
     * 并且，直接返回结果
     * 注意：自闭合标签没有子节点，所以不用处理 children
     */
    res += isVolidElement ? '/>' : '>'
    if (isVolidElement) {
        return res
    }


    if (typeof children === 'string') {
        res += children
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            res += renderElementVNode(child)
        })
    }

    res += `</${tag}>`

    return res
}

console.log(renderElementVNode(ElementVNode))