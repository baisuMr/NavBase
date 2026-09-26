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
    validator: (value) => ['success', 'error'].includes(value)
  },
  duration: { type: Number, default: 2400 },
  // 触发序号（来自 useToast）：同文案连续触发时 message 不变，靠 seq 变化重置计时
  seq: { type: Number, default: 0 }
})

const emit = defineEmits(['close'])
const visible = ref(false)
let timer = null

function startTimer() {
  // 清理上一条 toast 的定时器，避免旧定时器提前关闭新提示
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
    emit('close')
  }, props.duration)
}

// message 与 seq 任一变化都视为「新的一条提示」：message 用于首次显示，
// seq 保证同文案重复触发（message 不变）时旧定时器也被重置、不提前消失
watch([() => props.message, () => props.seq], ([val]) => {
  if (val) {
    visible.value = true
    startTimer()
  }
}, { immediate: true })

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>
