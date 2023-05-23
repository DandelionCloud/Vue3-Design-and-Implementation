 代理 Set 和 Map

## Set 类型的原型属性和方法`：

- `size`：返回集合中元素的数量
- `add(value)`：向集合中添加指定的值
- `clear()`：清空集合
- `delete(value)`：从集合中删除指定的值
- `has(value)`：判断集合中是否存在给定的值
- `keys()`：返回一个迭代器对象。可用于 for…of 循环，迭代器对象产生的值为集合中的元素值。
- `values()`：对于 Set 集合类型来说，keys() 和 values() 等价
- `entries()`：返回一个迭代器对象。迭代过程中为集合中的没一个元素产生一个数组值 [value, value]。
- `forEach(callback[, thisArg])`：forEach 函数会遍历集合中的元素，并对每一个元素调用 callback 函数。接收可选的第二个参数 thisArg，用于指定 callback 函数执行时的 this 值。

## Map 类型的原型属性和方法`：

- `size`：返回 Map 数据中键值对数量
- `clear()`：清空 Map
- `delete(key)`：删除指定 key 的键值对
- `has(key)`：判断 Map 中是否存在指定 key 的键值对
- `get(key)`：读取指定 key 对应的值
- `set(key, value)`：为 Map 设置新的键值对
- `keys()`：返回一个迭代器对象。迭代过程中会产生键值对的 key 值。
- `values()`：返回一个迭代器对象。迭代过程中会产生键值对的 value 值。
- `entries()`：返回一个迭代器对象。迭代过程中会产生由 [key, value] 组成的数组值。
- `forEach(callback[, thisArg])`：forEach 函数会遍历 Map 数据的所有键值对，并对每一个键值对调用 callback 函数。接收可选的第二个参数 thisArg，用于指定 callback 函数执行时的 this 值。

## 整体思路不变：

**当读取操作发生时，调用 track 函数建立响应联系；当设置操作发生时，调用 trigger 函数触发响应**


### 影响集合大小（元素数量），但对于具体的key未知的情况下，副作用函数与ITERATE_KEY建立响应联系：
`track(target, ITERATE_KEY)`
- for...in 循环遍历一个对象（普通对象，数组有专门的 length 属性）：只关心键
- forEach 循环遍历一个集合：关心键和值
- 集合类型的 size 属性

### ADD 或 DELETE 类型的操作触发响应：
`bucket.get(target).get(ITERATE_KEY)`
- 

