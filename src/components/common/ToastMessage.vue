<template>
  <Transition name="toast">
    <div v-if="visible" class="toast" :class="type">
      <span>{{ message }}</span>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  type: {
    type: String,
    default: 'success',
    validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
  },
  duration: { type: Number, default: 2400 }
})

const emit = defineEmits(['close'])
const visible = ref(false)
let timer = null

watch(() => props.message, (val) => {
  if (val) {
    visible.value = true
    // 清理上一条 toast 的定时器，避免旧定时器提前关闭新提示
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
      emit('close')
    }, props.duration)
  }
}, { immediate: true })

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>
