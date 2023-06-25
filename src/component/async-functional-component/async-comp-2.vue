<template>
    <!-- 同步组件 -->
    <CompA />
    <!-- 异步组件 -->
    <AsyncComp />
</template>

<script>
import { defineAsyncComponent, shallowRef } from 'vue'
import CompA from '../../app.vue'

export default {
    components: {
        CompA,
        // 通过 defineAsyncComponent 来定义异步组件，相较于 13.1 中自行实现的方式简单直接
        AsyncComp: defineAsyncComponent(() => import('asyncComp.vue'))
    },
}
</script>