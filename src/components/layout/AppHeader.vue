<template>
  <header class="app-header">
    <div class="app-header-inner">
      <!-- 左侧：品牌 + 导航 -->
      <div style="display:flex;align-items:center;gap:var(--space-lg);">
        <a class="app-header-brand" href="#startpage-hero">
          <span class="material-symbols-outlined">bookmark_heart</span>
          <span class="app-header-brand-name">{{ siteName }}</span>
        </a>

        <nav class="app-header-nav" aria-label="主导航">
          <a class="app-header-nav-link active" href="#startpage-hero">Overview</a>
          <a class="app-header-nav-link" href="#explorer-section">Collections</a>
        </nav>
      </div>

      <!-- 右侧：设置 + 添加 + 头像 -->
      <div class="app-header-actions">
        <button
          type="button"
          class="btn-icon-circle"
          @click="$emit('open-settings')"
          aria-label="设置"
          title="设置"
        >
          <span class="material-symbols-outlined" style="font-size:20px;">settings</span>
        </button>

        <button
          type="button"
          class="btn-icon-circle"
          @click="$emit('add-bookmark')"
          aria-label="添加书签"
          title="添加书签 (Alt+N)"
        >
          <span class="material-symbols-outlined" style="font-size:20px;">add</span>
        </button>

        <!-- 头像仅作展示，退出登录在设置面板中 -->
        <div class="app-header-avatar" :title="username">
          <img v-if="avatar" :src="avatar" alt="头像" />
          <span v-else class="material-symbols-outlined">person</span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

defineProps({
  username: {
    type: String,
    default: '管理员'
  }
})

defineEmits(['open-settings', 'add-bookmark'])

const settings = useSettingsStore()
const siteName = computed(() => settings.displayName)
const avatar = computed(() => settings.avatar)
</script>
