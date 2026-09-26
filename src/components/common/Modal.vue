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

// Tab 焦点陷阱（document 级）：焦点在弹窗内、或掉到 body（点击不可聚焦区域 /
// loading 中按钮被禁用）时，把 Tab/Shift+Tab 循环限制在对话框内，防止逃逸到遮罩背后的页面。
// 不能用 dialogEl 元素级监听——焦点在 body 时事件不经过 dialogEl，陷阱会"粘性"失效
function trapTab(e) {
  if (e.key !== 'Tab') return
  const dialog = dialogEl.value
  if (!dialog) return
  const active = document.activeElement
  const inDialog = dialog.contains(active)
  if (!inDialog && active !== document.body) return

  const focusables = [
    ...dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ].filter(el => !el.disabled)

  // 弹窗内无可聚焦元素（如 loading 中全部禁用）：吞掉 Tab，焦点留在原地不逃逸
  if (!focusables.length) {
    e.preventDefault()
    return
  }

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (!inDialog) {
    // 焦点在 body：按方向把焦点收进弹窗首/尾
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
    return
  }
  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  lastFocused = document.activeElement
  closeBtn.value?.focus()
  document.addEventListener('keydown', trapTab)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', trapTab)
  if (lastFocused && typeof lastFocused.focus === 'function' && lastFocused.isConnected) {
    lastFocused.focus()
  }
})
</script>
