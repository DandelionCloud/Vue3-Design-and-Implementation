# 由使用 Reflect 的 Proxy 封装而来

前置文件 reflect-5-summary.js

1. 解决问题：由原型集成而来的属性，设置值时，触发了两次副作用函数重新执行
2. 解决问题：实现深响应
3. 封装 createReactive 函数，由此可以轻松实现 reactive 和 shallowReactive
