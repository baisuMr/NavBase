<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      ref="dialogEl"
      @keydown.esc.stop="$emit('close')"
    >
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button
          ref="closeBtn"
          class="modal-close"
          :disabled="closeBtnDisabled"
          @click="$emit('close')"
          aria-label="关闭"
        >
          <i class="ri-close-line"></i>
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  // 仅禁用右上角关闭按钮；遮罩/ESC 关闭由使用方自行决定是否响应
  closeBtnDisabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const dialogEl = ref(null)
const closeBtn = ref(null)
// 打开前持有焦点的元素，关闭时还原
let lastFocused = null

// Tab 焦点陷阱：Tab / Shift+Tab 在对话框内循环，跳过禁用元素
function trapTab(e) {
  if (e.key !== 'Tab') return
  const focusables = [
    ...dialogEl.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ].filter(el => !el.disabled)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  lastFocused = document.activeElement
  closeBtn.value?.focus()
  dialogEl.value?.addEventListener('keydown', trapTab)
})

onBeforeUnmount(() => {
  dialogEl.value?.removeEventListener('keydown', trapTab)
  if (lastFocused && typeof lastFocused.focus === 'function' && lastFocused.isConnected) {
    lastFocused.focus()
  }
})
</script>
