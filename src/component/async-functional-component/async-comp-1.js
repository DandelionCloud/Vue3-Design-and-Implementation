/**
 * 第 13 章 异步组件与函数式组件
 * [13.1 异步组件要解决的问题]
 * 异步加载组件时的问题：
 * 1. 加载失败或加载超时，是否要渲染 Error 组件
 * 2. 组件正在加载时，是否要展示占位，如 Loading 组件，以及延时展示
 * 3. 组件加载失败后，是否需要重试
 * 
 * 框架层面为异步组件提供的封装能力：
 * 1. 允许用户指定加载出错时要渲染的组件 ===> ErrorComponent
 * 2. 允许用户指定 Loading 组件，以及展示该组件的延迟时间
 * 3. 允许用户设置加载组件的超时时长
 * 4. 组件加载失败后，为用户提供重试的能力
 */

// 同步渲染
import App from '../../App.vue'
import { createApp } from 'vue'
createApp(App).mount('#app')

// 异步渲染（整个页面异步渲染）
// 使用动态倒入语句 import() 来加载组件，返回一个 promise 实例
const loader = () => import('App.vue')
loader().then(App => {
    createApp(App).mount("#app")
})

// 异步渲染部分页面 <=> 异步加载某一个组件