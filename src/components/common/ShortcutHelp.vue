<template>
  <Modal title="键盘快捷键" @close="$emit('close')">
    <div class="shortcut-help">
      <div class="shortcut-row">
        <span>聚焦搜索框</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Alt</span>
          <span class="kbd">K</span>
        </span>
      </div>
      <div class="shortcut-row">
        <span>添加书签</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Alt</span>
          <span class="kbd">N</span>
        </span>
      </div>
      <div class="shortcut-row">
        <span>添加分类</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Alt</span>
          <span class="kbd">Shift</span>
          <span class="kbd">N</span>
        </span>
      </div>
      <div class="shortcut-row">
        <span>关闭弹窗 / 菜单</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Esc</span>
        </span>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import Modal from './Modal.vue'

defineEmits(['close'])
</script>
