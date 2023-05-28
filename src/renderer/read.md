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
    setElementText(el, text) {
        el.textContent = text
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor)
    },
    // 将属性设置的相关操作封装到 patchProps 函数中，作为渲染器选项传递
    patchProps(el, key, prevValue, nextValue) {
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

```js
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

```js
function unmount(vnode) {
    const parent = vnode.el.parentNode
    if (parent) {
        parent.removeChild(vnode.el)
    }
}
```

# 第八章 挂载和更新
`mountElement` 函数：挂载函数，将虚拟节点 vnode 挂载到容器 container 上。

```js
function mountElement(vnode, container) {
    // 在虚拟节点和真实元素之间建立联系，vnode.el 引用真实的 DOM 元素
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
        // ...
    }
    insert(el, container)
}
```
## 一、挂载子节点 `vnode.children`

### 1. 子节点是字符串：直接渲染文本节点

```js
if (typeof vnode.children === 'string') {
    setElementText(el, vnode.children)
}
```
### 2. 子节点是数组：循环遍历挂载
```js
if (Array.isArray(vnode.children)) {
    vnode.children.forEach(child => {
        patch(null, child, el)  // mountElement(child, el)
    })
}
```

## 二、挂载元素属性 `vnode.props`

```js
for (const key in vnode.props) {
    patchProps(el, key, null, vnode.props[key])
}
```

### 1、普通 `props` 处理

为元素设置属性的方法：

1. `setAttribute` 函数：`element.setAttribute(propName, propValue)` ===> 值被字符串化
2. 直接通过 `DOM` 对象设置：`element[propName] = propValue`

注意：
- 优先设置 `DOM Properties`，当值为空字符串时，手动矫正为 `true`.

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

Vue.js 对 `class` 和 `style` 属性做了增强，需要特殊处理。

Vue.js 中为元素设置类型的方式：

- 指定为一个字符串：

    `class="foo bar"`

- 指定为一个对象值：

    `:class="cls"; const cls = { foo: true, bar: false}`

- 包含上述两类的数组： 

    `:class="arr"; const arr = ['foo bar', { baz: true }]`

所以，在设置元素的 `class` 之前将值归一化为统一的字符串形式，封装 `normalizeClass` 函数。
    
浏览器平台为元素设置 `class` 的三种方法：
- `setAttribute`
- `el.calssName`（性能最优）
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

以 `on` 开头的属性约定为事件。使用伪造的事件处理函数，并将其缓存在 `el.vei` (vue event invoker的简写)中。
- 真正的事件处理函数存储在 `invoker.value` 上，更新事件处理函数时，只需要更新 `invoker.value` 值即可，减少事件多次移除和添加操作的性能消耗。
- 伪造事件处理函数执行时，其内部真正执行的是真正的事件处理函数。



```js
// 基于浏览器平台，被抽离的设置属性的配置
function patchProps(el, key, prevValue, nextValue) {
    // 处理事件
    if(/^on/.test(key)){
        let invoker = el._vei
        const name = key.slice(2).toLowerCase()
        if (nextValue) {
            // 首次创建 invoker 并缓存、赋值、绑定
            if (!invoker) {
                invoker = el._vei = (e) => {
                    invoker.value(e)
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
    // 其他省略
}
```


### 2. **激活 hydrate**