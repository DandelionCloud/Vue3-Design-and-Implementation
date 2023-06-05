# 快速 Diff 算法

**预处理过程**：处理相同的前置节点和后置节点（仅更新，不移动）

核心 Diff 算法位于 `patchKeyedChildren` 函数中，该函数有三个参数，分别是:
- `n1`：旧 vnode 
- `n2`：新vnode 
- `container`：容器

## 一、处理相同的前置节点

找出相同的前置节点，并调用 `patch` 函数完成打补丁操作:
1. 索引 `j` 指向新旧两组子节点的开头
2. `while` 循环向后遍历，直到遇到拥有不同 `key` 值的节点为止

```js
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
```

## 二、处理相同的后置节点

找出相同的后置节点，并调用 `patch` 函数进行打补丁操作:
1. 因为两组长度不一定相同，定义两个索引 `oldEnd` 和 `newEnd`
2. `while` 循环从后往前遍历，知道遇到拥有不同 `key` 值的节点为止

```js
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
```

## 三、新增节点

在预处理过后，所有旧子节点都处理完毕，但有新的子节点遗留，将被视为新增节点，要挂载：
1. `oldEnd < j` ：所有旧子节点都处理完了
2. `newEnd >= j` ：新的一组节点中有未被处理的节点，被视为新增节点
3. 新的一组子节点中，在索引值 `j`-`newEnd` 之间的节点属于新增节点，要挂载

```js
if (j > oldEnd && j <= newEnd) {
        // const anchorIndex = newEnd + 1
        // const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
        // 通过旧子节点取 DOM 元素也可以
        const anchor = oldChildren[j].el
        while (j <= newEnd) {
            patch(null, newChildren[j++], container, anchor)
        }
    }
```
## 四、遗留的旧子节点

在预处理过后，产生遗留旧节点的情况：
1. `j > newEnd` ：所有新子节点处理完了
2. `j <= oldEnd` ：旧的一组子节点中有未被处理的节点，需要移除
3. 旧的一组子节点中，在索引值 `j`-`oldEnd` 之间的节点需要卸载

```js
else if (j <= oldEnd && j > newEnd) {
    while (j <= oldEnd) {
        unmount(oldChildren[j++])
    }
}
```

## 五、非理想情况

非上述的任何一种情况的处理，需要一个 `source` 数组，用来存储未被处理的新子节点在旧子节点中的位置索引信息，初始值为 `-1`。通过该数组计算它的一个**最长递增子序列**
- 创建 `source`:
    ```js
    const count = newEnd - j + 1
    const source = new Array(count)
    // 使用 fill 填充数组
    source.fill(-1)
    ```

- 填充
