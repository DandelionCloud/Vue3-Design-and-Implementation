/**
 * 对于 HTML 属性的处理：
 * 1. boolean attribute：如果这类指令存在，则代表 true，否则代表 false
 *      如 <input type="checkbox" checked /> 表示选中的 checkbox
 * 2. 安全问题：根据 whatWG 规范定义
 * 3. 服务端渲染应该忽略的属性：
 *  3-1. 虚拟节点中的 props 对象中，包含的仅用于组件运行时逻辑的相关属性、事件处理函数
 *  3-2. key 属性：仅用于虚拟 DOM 的 Diff 算法
 *  3-3. ref 属性：仅用于实现 template ref 的功能
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
        // for (const k in props) {
        //     res += ` ${k}="${props[k]}"`
        // }
        // 调用 renderAttrs 函数进行严谨处理
        res += renderAttrs(props)
    }
    /**
     * 如果是 void element，则自闭合，并且直接返回结果
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

// 应该忽略的属性
const shouldIgnoreProp = ['key', 'ref']
function renderAttrs(props) {
    let res = ''
    for (const key in props) {
        // 检测属性名，如果是应该被忽略的或事件名，则忽略它
        if (shouldIgnoreProp.includes(key) || /^on[^a-z]/.test(key)) {
            continue
        }
        const value = props[key]
        res += renderDynamicAttr(key, value)
    }
}

// 用来判断属性是否是 boolean attribute
const isBooleanAttr = (key) =>
    (`itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly,` +
        `async,autofocus,autoplay,controls,default,defer,disabled,hidden,` +
        `loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`).split(',').includes(key)
// 用来判断属性名是否合法且安全
const isSSRSafeAttrName = key => !/[>/="'\u0009\u000a\u000c\u0020]/.test(key)
function renderDynamicAttr(key, value) {
    if (isBooleanAttr) {
        // 对于 boolean attribute，如果值为 false 则不需要渲染，反之只需要渲染 key 即可
        return value === false ? '' : `${key}`
    } else if (isSSRSafeAttrName(key)) {
        /**
         * 对于其他安全的属性，要执行完整的渲染
         * 注意：对于属性值，我们需要对它进行 HTML 转译操作
         */
        return value === '' ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`
    } else {
        // 跳过不安全的属性，并打印警告信息
        console.warn(`[@vue/server-renderer] Skipped rendering unsfe attribute name: ${key}`)
    }
    return ''
}

/**  
* HTML 转译：将特殊字符转换为对应的 HTML 实体。如下：
* 1. 普通文本：
*  字符 & ---> 实体 &amp;
*  字符 < ---> 实体 &lt;
*  字符 > ---> 实体 &gt;
* 2. 属性值，在上述三个字符外，还包括：
*  字符 " ---> 实体 &quto;
*  字符 ' ---> 实体 &#39;
*/
const escapeRE = /["'&<>]/
function escapeHtml(string) {
    const str = '' + string
    const match = escapeRE.exec(str)

    if (!match) return str
    let html = ''
    let escaped, index, lastIndex = 0
    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34:    // "
                escaped = '&quto;'
                break
            case 38:    // &
                escaped = '&amp;'
                break
            case 39:    // '
                escaped = '&#39;'
                break
            case 60:    // <
                escaped = '&lt;'
                break
            case 62:    // >
                escaped = '&gt;'
                break
            default:
                continue
        }
        if (lastIndex !== index) {
            html += str.substring(lastIndex, index)
        }
        lastIndex = index + 1
        html += escaped
    }
    return lastIndex !== index ? html + str.substring(lastIndex, index) : html
}

console.log(renderElementVNode(ElementVNode))