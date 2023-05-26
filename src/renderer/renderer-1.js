/**
 * 【渲染器的设计】
 * 使用 @vue/reactivity 包，提供响应式 API：
 * 1. IIFE 模式格式（Immediately Invoked Function Expression）
 * 2. 暴露全局 API 名为 VueReactivity
 */

import { effect, ref } from '@vue/reactivity'

function renderer(domString, container) {
    container.innerHTML = domString
}

// 渲染静态字符串
renderer('<h1>Hello</h1>', document.getElementById('app'))


// 渲染动态拼接的 HTML 内容
let count = 1
renderer(`<h1>${count}</h1>`, document.getElementById('app'))


// 结合响应系统
const count2 = ref(5)
effect(() => {
    renderer(`<h1>${count2.value}</h1>`, document.getElementById('app'))
})

setTimeout(() => { count2.value++ }, 2000)
