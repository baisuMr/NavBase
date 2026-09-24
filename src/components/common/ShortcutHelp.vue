<template>
  <Modal title="快捷操作" @close="$emit('close')">
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

      <!-- 书签栏快捷添加 -->
      <div class="shortcut-section-title">浏览器书签栏</div>
      <div class="shortcut-bookmarklet">
        <p class="shortcut-bookmarklet-hint">
          将下方按钮<b>拖到浏览器书签栏</b>，之后在任意网页点击该书签，
          即可弹窗抓取当前网址、标题与描述，一键收藏（需已在本浏览器登录过）。
        </p>
        <a
          class="btn btn-primary shortcut-bookmarklet-btn"
          :href="bookmarklet"
          title="按住拖到书签栏"
          draggable="true"
          @click.prevent
        >
          <i class="ri-bookmark-add-line"></i>
          <span>快捷添加书签</span>
        </a>
        <p class="shortcut-bookmarklet-hint">仅桌面浏览器可用（手机浏览器无书签栏）。</p>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import Modal from './Modal.vue'
import { buildQuickAddBookmarklet } from '../../utils/bookmarklet'

defineEmits(['close'])

// 生成时嵌入当前站点地址（书签脚本在目标网页执行时无法感知本站 origin）
const bookmarklet = computed(() => buildQuickAddBookmarklet(window.location.origin))
</script>
