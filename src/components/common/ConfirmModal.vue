<template>
  <Modal
    :title="title"
    :close-btn-disabled="loading"
    @close="handleClose"
  >
    <p class="confirm-message">{{ message }}</p>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" :disabled="loading" @click="$emit('cancel')">取消</button>
      <button type="button" class="btn btn-danger" :disabled="loading" @click="$emit('confirm')">
        {{ loading ? '处理中…' : confirmText }}
      </button>
    </div>
  </Modal>
</template>

<script setup>
import Modal from './Modal.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: '删除'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['confirm', 'cancel'])

// 遮罩点击 / 弹窗内 ESC 都经 Modal 的 close 汇入这里：
// loading 期间忽略，避免弹窗关掉但后台操作仍在跑
function handleClose() {
  if (!props.loading) emit('cancel')
}
</script>
