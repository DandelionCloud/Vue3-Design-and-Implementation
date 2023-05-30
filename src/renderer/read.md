# 渲染器 renderer

- 渲染器是用来执行渲染任务的，如浏览器平台上，渲染真实的 DOM 元素。
- 框架跨平台能力的关键

## @vue/reactivity 包
 - 提供响应式 API
 - 暴露全局 API 名为 Vuereactivity


## 渲染器的基本概念

- **渲染器** renderer
- 渲染 render
> 渲染器的作用：把虚拟 DOM 渲染为特定平台上的真实元素。
> - 浏览器平台：虚拟 DOM ---> 真实 DOM 元素

- **虚拟 DOM**：virtual DOM 简写 vdom
- 虚拟节点：virtual node 简写 vnode
> 虚拟 DOM 和真实 DOM：结构一样 ===> 树形结构
```js
const vnode = {
    type: 'div',    // 元素类型
    // 子节点
    children: [
        { type: 'p', children: 'hello'}
    ],
    // 属性
    props: {
        id: 'foo'
    }
}
```


- **挂载 mount**：渲染器把虚拟 DOM 节点渲染为真实 DOM 节点的过程。
> Vue.js 组件中的 mounted 钩子函数，会在挂载完成时触发。所以 mounted 钩子中可以访问真实的 DOM 元素。

- **挂载点 container**
> 渲染器需要一个挂载点参数，用于指定具体的挂载位置。*挂载点*就是一个 DOM 元素，作为*容器元素*，渲染器会把内容渲染到其中。

## 创建渲染器
```js
function createRenderer(options) {
    // 独立于平台的配置项
    const {
        createElement,
        insert,
        setElementText,
        patchProps
    } = options
    // 渲染
    function render(vnode, container) {
        if (vnode) {
            // 新旧节点 ===> 打补丁
        } else {
            // 仅有旧节点 ===> 卸载
        }
    }
    // 激活
    function hydrate(vnode, container) {
        // ...
    }
    return {
        render,
        hydrate
    }
}

// 基于浏览器平台抽离的配置项
const options = {
    createElement(tag) {
        return document.createElement(tag)
    },
    // 设置文本内容
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
            // 处理事件
        }
        else if (key === 'class') {
            // 处理 class
        }
        else if (key === 'style') {
            // 处理 style
        }
        if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key]
            // 布尔类型的属性，矫正空字符串为 true 
            if (type === 'boolean' && nextValue === '') {
                el[key] = true
            } else {
                el[key] = nextValue
            }
        } else {
            el.setAttribute(key, nextValue)
        }
    }
}

// 其他判断函数
// 判断属性是否应该作为 DOM Properties 设置
function shouldSetAsProps(el, key, value) {
    // 排除表单元素（只读）
    if (key === 'form') return false
    // 兜底
    return key in el
}
```

## 渲染器的作用
### 1. **渲染 render**
    
`render` 函数：将虚拟节点渲染为真实的元素。（浏览器平台是渲染为真实的 DOM 元素）

```javascript
function render(vnode, container) {
    if (vnode) {
        // 新旧节点 ===> 打补丁
        patch(container._vnode, vnode, container)
    } else {
        // 仅有旧节点 ===> 卸载
        unmount(container._vnode)
    }
    container._vnode = vnode
}
```

`patch` 函数：新旧 vnode 都存在时，进行打补丁（更新）操作。其中承载最重要的渲染逻辑。

- 如果新旧节点描述的内容不一样，即 `vnode.type` 属性值不同，则需要卸载旧节点，挂载新节点。注意，卸载旧节点后，要重置旧节点为 `null` 保证后续挂载正确执行。

- 一个 `vnode` 可以描述多种类型：普通标签、组件 、`Fragment`。依据不同的类型，需要提供不同的挂载和打补丁的方式。
     
    1. **普通标签**：
    
        其 `type` 类型为 `string`，使用普通标签的挂载 `mountElement` 和打补丁 `patchElement` 方式。

    2. **文本节点**：

        其 `type` 为表示文本节点的唯一标识 `Text(Symbol)`，使用文本节点的挂载 `createText` 和打补丁 `setText` 方式。

    3. **Fragment**：

        其 `type` 为 `Fragment`，渲染 `Fragment` 与渲染普通元素的区别在于，只需要处理其子节点即可。同时卸载 `unmount` 函数中也要支持 `Fragment` 类型的虚拟节点的卸载。

```js
// 文本节点的 type 标识
const Text = Symbol()
// 注释节点的 type 标识
const Comment = Symbol()

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
            // 挂载
            mountElement(n2, container)
        } else {
            // 更新
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
```

`unmount` 函数：卸载函数
1. 根据 `vnode` 获取要卸载的真实 `DOM` 元素
2. 获取 `el` 的父元素
3. 在父元素上调用 `removeChild` 移除元素
4. 支持 `Fragment` 的卸载：仅需要处理其子节点

```js
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
```

# 第八章 挂载和更新
## 挂载

`mountElement` 函数：挂载函数，将虚拟节点 `vnode` 挂载到容器 `container` 上。

1. 创建对元素

2. 挂载子节点 `vnode.children`

3. 处理属性 `vnode.props`

注意：需要在 *虚拟节点 `vnode`* 和 *真实元素* 之间建立联系：`vnode.el` 引用真实的元素。

```js
function mountElement(vnode, container) {
    // 建立联系
    const el = vnode.el = createElement(vnode.type)
    // 处理 children
    if (vnode.children) {
        // ...
    }
    // 处理 props
    if (vnode.props) {
        for (const key in vnode.props) {
            patchProps(el, key, null, vnode.props[key])
        }
    }
    insert(el, container)
}
```

## 一、挂载子节点 `vnode.children`

- 子节点是字符串：直接渲染文本节点

```js
if (typeof vnode.children === 'string') {
    setElementText(el, vnode.children)
}
```

- 子节点是数组：循环遍历挂载
```js
if (Array.isArray(vnode.children)) {
    vnode.children.forEach(child => {
        patch(null, child, el)  // 等价于 mountElement(child, el)
    })
}
```

## 二、挂载元素属性 `vnode.props`

`patchProps` 函数：基于浏览器平台，被抽离的设置属性的配置。属性中存储的特殊数据有：事件 `event`、`class`、`style`

```js
patchProps(el, key, prevValue, nextValue) {
    if (/^on/.test(key)) {
        // 处理事件
    }
    else if (key === 'class') {
        // 处理 class
    }
    else if (key === 'style') {
        // 处理 style
    } else {
        // 处理普通属性
    }
}
```

### 1、普通属性处理

浏览器平台中，为元素设置属性的方法有：

- 通过 `setAttribute` 函数：`element.setAttribute(propName, propValue)` 
    
    该方法将导致值被字符串化

- 直接通过 `DOM` 对象设置：`element[propName] = propValue`

最优设置方式：优先设置 `DOM Properties`，其中当值为空字符串时手动矫正为 `true`；再通过 `setAttribute` 设置 `HTML Properties`。

```js
// 基于浏览器平台，被抽离的设置属性的配置
function patchProps(el, key, prevValue, nextValue) {
    // 普通 props
    if (shouldSetAsProps(el, key, nextValue)) {
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
```

### 2、`class` 处理

Vue.js 对 `class` 和 `style` 属性做了增强，所以需要特殊处理，此处以 `class` 为例，在 Vue.js 中为元素设置类型的方式：

- 字符串：
    `class="foo bar"`

- 对象：
    `:class="cls"; const cls = { foo: true, bar: false}`

- 数组（包含上述两种）： 
    `:class="arr"; const arr = ['foo bar', { baz: true }]`

所以，在设置元素的 `class` 之前将值归一化为统一的字符串形式，封装 `normalizeClass` 函数，此处不做详解。
    
浏览器平台为元素设置 `class` 的三种方法：
- `setAttribute`
- `el.className`（性能最优）
- `el.classList`

```js
// 基于浏览器平台，被抽离的设置属性的配置
function patchProps(el, key, prevValue, nextValue) {
    // 处理 class 
    if(key === 'class') {
        el.className = nextValue || ''
    }
    // 其他省略
}
```

### 3、事件处理

我们约定以 `on` 开头的属性名为事件名，其对应的属性值是事件处理函数，处理思路如下：
- 使用伪造的事件处理函数 `invoker`，并将其缓存在 `el.vei` （vue event invoker 的简写）中。

- 真正的事件处理函数存储在 `invoker.value` 上，更新事件处理函数时，只需要更新 `invoker.value` 值即可（减少事件多次移除和添加操作的性能消耗）

- 伪造的事件处理函数执行时，在其内部执行真正的事件处理函数。

 注意：
- 一个元素可以绑定多个同类型的事件处理函数，这多个事件处理函数可以共存：使用数组存储多个事件处理函数

- 屏蔽所有绑定时间 `attached` 晚于事件触发时间 `e.timeStamp` 的事件处理函数的执行。

```js
// 基于浏览器平台，被抽离的设置属性的配置
function patchProps(el, key, prevValue, nextValue) {
    // 处理事件
    if(/^on/.test(key)){
        // 定义 el.vei 为一个对象，存储事件名称到事件处理函数的映射
        const invokers = el._vei || (el.vei = {})
        let invoker = el._vei[key]
        const name = key.slice(2).toLowerCase()
        if (nextValue) {
            // 首次创建 invoker 并缓存、赋值、绑定
            if (!invoker) {
                invoker = el._vei[key] = (e) => {
                    if (e.timeStamp < invoker.attached) return
                    // 遍历数组
                    if (Array.isArray(invoker.value)) {
                        invoker.value.forEach(fn => fn(e))
                    } else {
                        // 直接调用
                        invoker.value(e)
                    }
                }
                invoker.value = nextValue
                // 存储事件绑定时间
                invoker.attached = performance.now()
                el.addEventListener(name, invoker)
            } else {
                invoker.value = nextValue
            }
        } else if (invoker) {
            // 新的事件绑定函数不存在，且前一次绑定的 invoker 存在，则移除事件
            el.removeEventListener(name, invoker)
        }
    }
    // 其他省略
}
```

## 三、更新

`patchElement` 函数，在新旧节点之间进行更新：先处理其节点属性，再 通过 `patchChildren` 函数处理节点的子节点。

```js
function patchElement(n1, n2) {
    // 更新 props 
    // ...

    // 更新 children
    // ...
}
```

### 1、更新属性

- 遍历处理新属性 `newProps`：

    - 如果新旧属性值不同，则用新属性值（`newProps[key]`）覆盖旧属性值（`oldProps[key]`）

    - 如果相同，则不作处理

- 遍历处理旧属性 `oldProps`：

    - 如果旧属性名不存在于新节点中，则移除该旧属性

    - 如果存在于新节点中，则会在上一步进行处理

```js
function patchElement(n1, n2) {
    const el = n2.el = n1.el
    // 更新 props 
    const oldProps = n1.props
    const newProps = n2.props
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
```
### 2、更新子节点

新旧子节点可能的类型：

- 没有子节点 `null`

- 文本子节点 `string`

- 一组子节点 `Array`

根据新旧节点的组合，将会产生 9 种情况，但没有没有子节点和文本子节点合并处理后，存在一下 6 种情况，以更新目标新节点为基点划分：

1. 新节点的子节点是文本节点：

    - 旧节点的子节点是一组子节点，则逐个卸载 `unmount`

    - 旧节点的子节点是文本节点或没有子节点时，则直接为容器设置文本内容 `setElementText`

2. 新节点没有子节点：

    - 旧节点的子节点是一组子节点，则逐个卸载 `unmount`

    - 旧节点的子节点是文本节点，则置空容器的文本内容

3. 新节点的子节点是一组子节点：

    - 旧节点的子节点是文本节点，则置空容器的文本内容，并逐个挂载新节点的子节点 `mount`

    - 旧节点的子节点是一组子节点，则需要使用 第九章将开始详细介绍的 ***`Diff` 算法***

```js
function patchChildren(n1, n2, container) {
    // 新子节点是文本节点
    if (typeof n2.children === 'string') {
        if (Array.isArray(n1.children)) {
            n1.children.forEach(child => unmount(child))
        }
        setElementText(container, n2.children)
    } else if (Array.isArray(n2.children)) {
        // 新子节点是一组子节点
        if (Array.isArray(n1.children)) {
            // 旧子节点也是一组字节时
            // !!! Diff 算法，第九章详解 !!!
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
```


### 2. **激活 hydrate**

详情请查看最后一章，*同构渲染*