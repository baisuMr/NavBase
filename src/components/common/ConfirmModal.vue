<template>
  <Modal :title="title" @close="$emit('cancel')">
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

defineProps({
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

defineEmits(['confirm', 'cancel'])
</script>
