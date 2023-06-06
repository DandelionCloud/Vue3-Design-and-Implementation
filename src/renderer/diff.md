# Diff 算法

```TIP
遵循同样的处理规则：
1. 判断是否有节点需要移动，以及应该如何移动
2. 找出那些需要被添加或删除的节点
```

## 简单 Diff 算法

## 双端 Diff 算法

## 快速 Diff 算法
```tip
最早应用于 ivi、inferno 这两个框架
```
借鉴了纯文本 Diff 算法的思路，即**预处理过程**（处理相同的前置节点和后置节点）

### 一、**预处理**步骤

对于相同的前置节点和后置节点，因为它们在新旧两组子节点中的相对位置不变，所以不需要移动，仅需要进行打补丁 `patch`

#### 1、相同的前置节点

建立索引 `j`，初始值为 `0`，指向两组子节点的开头；开启 `while` 向后循环，让 `j` 递增，直到遇到不同 `key` 值的节点为止：

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

#### 2、相同的后置节点

因为两组子节点的数量可能不同，新建两个索引 `newEnd` 和 `oldEnd` 分别指向新旧两组子节点的末尾；开启 `while` 从后向前循环，两个索引值递减，直到遇到不同 `key` 值的节点为止：

```js
// 索引 oldEnd 指向旧的一组子节点的最后一个节点
let oldEnd = oldChildren.length - 1
// 索引 newEnd 指向新的一组子节点的最后一个节点
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

### 二、恰好一组子节点处理完毕

#### 1、旧的一组子节点处理完毕

在预处理过后，如果所有旧的一组子节点都已处理完毕，但有新的子节点遗留，这些新子节点将被视为新增节点，需要被挂载 `mount`。
- `oldEnd < j` ：所有旧子节点都处理完了
- `newEnd >= j` ：新的一组节点中有未被处理的节点，被视为新增节点
- 新的一组子节点中，在索引值 `j ~ newEnd` 之间的节点属于新增节点，要挂载

```js
if (j > oldEnd && j <= newEnd) {
    const anchorIndex = newEnd + 1
    const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
    const anchor = oldChildren[j].el
    while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor)
    }
}
```
注意：上述代码中通过新子节点获取真实元素作为锚点，也可以通过旧子节点获取：

```js
const anchor = oldChildren[j].el
```

#### 2、新的一组子节点处理完毕

在预处理过后，如果新的一组子节点都已处理完毕，但有旧的子节点遗留，这些旧子节点需要被卸载 `unmount`。
1. `j > newEnd` ：所有新子节点处理完了
2. `j <= oldEnd` ：旧的一组子节点中有未被处理的节点，需要移除
3. 旧的一组子节点中，在索引值 `j ~ oldEnd` 之间的节点需要卸载

```js
else if (j <= oldEnd && j > newEnd) {
    while (j <= oldEnd) {
        unmount(oldChildren[j++])
    }
}
```

### 三、复杂情况（两组子节点都有部分未经处理）

经过预处理后，新旧两组子节点都有部分节点未经处理，这种非理想情况下，索引 `j`、`newEnd`、`oldEnd` 不满足下面两个条件中的任何一个：
- `j > oldEnd && j <= newEnd`
- `j > newEnd && j <= oldEnd`

因此，在上述基础上，增加一个 `else` 分支，来处理非理想情况。

接下来讲解具体思路：

1、构造 `source` 数组

该数组的长度等于新的一组子节点经过预处理之后，去掉相同前置/后置节点后，剩余的未处理的节点数量，且数组中每个元素的初始值都是 `-1`。

```js
// 新的一组子节点中剩余未处理节点的数量
const count = newEnd - j + 1
const source = new Array(count)
source.fill(-1)
```

`source` 数组中的每一个元素都与新的一组子节点中剩余未处理节点对应。实际上，该数组将用来存储新的一组子节点中的节点在旧的一组节点 中的位置索引，后面将使用他计算一个最长递增子序列，用于辅助完成 `DOM` 的移动。

- 填充 `source` 数组（方案一）
    ```js
    // 填充 source 数组（方案一）
    for(let i = j; i <= oldEnd; i++) {
        const oldVNode = oldChildren[i]
        for(let k = j; k <= newEnd; k++) {
            const newVNode = newChildren[k]
            // 找到 key 值相同的节点
            if(oldVNode.key === newVNode.key) {
                patch(oldVNode, newVNode, container)
                source[k-j] = i
            }
        }
    }
    ```

    以上，通过两层嵌套循环，其时间复杂度为 `O(n1*n2)` 即 `O(n^2)`，当新旧两组子节点的数量较多时，两层嵌套循环会带来性能问题。因此需要优化，使用方案二，如下。

- 填充 `source` 数组（方案二）
    
    为新的一组未被处理的子节点构建一个索引表，存储节点 `key` 值和位置索引的映射，然后通过索引表来填充 `source` 数组：

    ```js
    const keyIndex = {}
    // 构建索引表：循环遍历新的一组未被处理的节点
    for(let i = j; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i
    }
    // 循环遍历旧的一组未被处理的节点
    for(let i = j; j <= oldEnd; i++) {
        const oldVNode = oldChildren[i]
        const k = keyIndex[oldVNode.key]
        // 找到 key 值相同的新子节点
        if(typeof k !== 'undefined') {
            const newVNode = newChildren[k]
            patch(oldVNode, newVNode, container)
            // 填充 source
            source[k - j] = i
        } else {
            // 多余的旧子节点
            unmount(oldVNode)
        }
    }
    ```
    以上，通过索引表完成填充，只有一层循环，时间复杂度降低为 `O(n)`，性能更优。

2、判断节点是否需要移动

快速 Diff 算法判断节点是否需要移动的方法，与简单 Diff 算法类似。

*简单 Diff 算法：在遍历过程中，遇到的索引值呈递增趋势，则说明不需要移动节点，反之则需要。即找到最大索引值，位置索引小于最大索引值的节点需要移动。*

注意：最大索引值是在另一组字节中找到的相同 key 值的节点的位置索引。如：遍历旧的一组子节点，在新的一组字节点中找打相同 key 值的节点，这个过程中，遇到的节点在新子节点中的位置索引最大时，为最大索引值。

通过变量 `moved`、`pos` 和 `patched` 来分别记录是否需要移动、最大索引值和已经更新过的节点数量：

```js
// 省略其他代码
let moved = false
let pos = 0
let patched = 0

for(let i = j; i <= oldEnd; i++) {
    const oldVNode = oldChildren[i]
    // 更新过的节点数量 <= 需要更新的节点数量时，执行更新
    if(patched <= count) {
        const k = keyIndex[oldVNode.key]
        if(typeof k !== 'undefined') {
            const newVNode = newChildren[k]
            patch(oldVNode, newVNode, container)
            // 记录更新过的节点数量
            patched ++
            source[k - j] = i
            // 判断节点是否需要移动
            if(k < pos) {
                moved = true
            } else {
                pos = k
            }
        } else {
            unmount(oldVNode)
        }
    } 
    // 否则卸载旧节点
    else {
        unmount(oldVNode)
    }
}
```

3、移动元素

通过上述变量 `moved` 的值，可以知道是否需要移动，为 `true` 时需要移动 `DOM` 元素。

- 计算最长递增子序列：

    ```tip
    给定一个数值序列，找到它的一个子序列，并且该序列中的值是递增的，子序列中的元素在原序列中不一定连续。一个序列可能有多个递增子序列，其中最长的那一个就称为最长递增子序列。

    注意：一个数值序列的最长递增子序列可能有多个。
    ```
    
    由 `source` 数组计算得出，此处不做讲解，代码如下：
    ```js
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

    const seq = getSequence(source)
    ```

    注意：上述 `getSequence` 函数的返回结果是，最长递增子序列中的元素在 `source` 数组中的位置索引。

- 移动节点：
    
    创建两个索引值 `i` 和 `s` ：
    - 索引 `i` 指向新的一组中未经处理的子节点中的最后一个节点
    - 索引 `s` 指向最长递增子序列中的最优一个节点

    要求：两个索引值，分别对未处理的新子节点和最长递增子序列，从后往前遍历（好处：减少判断，代码优雅）
  
    ```js
    if(moved) {
        let s = seq.length - 1
        let i = count - 1
        for(i; i>=0; i--){
            if(i !== seq[s]) {
                // 移动元素
                const newIndex = i + j
                const newVNode = newChildren[newIndex]
                const anchor = newIndex + 1 < newChildren.length ? newChildren[newIndex + 1].el : null
                // 移动
                insert(newVNode.el, container, anchor)
            } else {
                // 不需要移动，s 指向下一个位置
                s--
            }
        }
    }
    ```

- 挂载新节点：

    当 `source` 数组中元素为 `-1` 时，说明此位置上的节点为新增节点，需要挂载。因此，上述移动元素之前，增加一条判断：
    ```js
    if(source[i] === -1) {
        // 该节点在 newChildren 中真实的索引位置
        const newIndex = i + j
        const newVNode = newChildren[newIndex]
        // 锚点
        const anchor = newIndex + 1 < newChidlren.length ? newChildren[newIndex + 1].el : null
        // 挂载
        patch(null, newVNode, container, anchor)
    }
    ```

最终整合代码：
```js
function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    // 1. 处理相同的前置节点，while 循环向后遍历
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
    // 2. 处理相同的后置节点，while 循环从后往前遍历
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
    // 3. 恰好只剩新子节点未经处理，挂载索引值在 j-newEnd 之间的新增节点
    if (j > oldEnd && j <= newEnd) {
        const anchorIndex = newEnd + 1
        const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
        while (j <= newEnd) {
            patch(null, newChildren[j++], container, anchor)
        }
    }
    // 4. 恰好只剩旧子节点未经处理，卸载索引值在 j-oldEnd 之间的旧节点
    else if (j <= oldEnd && j > newEnd) {
        while (j <= oldEnd) {
            unmount(oldChildren[j++])
        }
    }
    // 5. 处理非理想情况（新旧子节点都存在未经处理的节点）
    else {
        // 构建 source 数组
        const count = newEnd - j + 1
        const source = new Array(count)
        source.fill(-1)

        // 填充 source
        const oldStart = j
        const newStart = j
        // 构建索引表 keyIndex (key-index)
        const keyIndex = {}
        // 判断节点是否需要移动
        let moved = false
        let pos = 0
        // 代表更新过的节点数量
        let patched = 0
        for (let i = newStart; i <= newEnd; i++) {
            keyIndex[newChildren[i].key] = i
        }
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
```
