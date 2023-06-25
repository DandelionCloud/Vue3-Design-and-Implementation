<template>
    <!-- CompA 是同步渲染的 -->
    <CompA /> 
    <!-- CompB 是异步加载和渲染的 -->
    <component :is="asyncComp" />
</template>

<script>
import { shallowRef } from 'vue'
import CompA from '../../app.vue'

export default {
    components: { CompA },
    setup() {
        const asyncComp = shallowRef(null)
        // 通过动态倒入语句 import() 来异步加载 CompB 组件
        import('CompB.vue').then(CompB => asyncComp.value = CompB)
        return {
            asyncComp
        }
    }
}
</script>