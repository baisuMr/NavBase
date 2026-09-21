<template>
  <header class="app-header">
    <div class="app-header-inner">
      <a class="app-header-brand" href="#startpage-hero">
        <span class="app-header-logo">
          <i class="ri-flash-fill"></i>
        </span>
        <span class="app-header-name">{{ siteName }}</span>
      </a>

      <div class="app-header-actions">
        <button
          type="button"
          class="app-header-btn"
          @click="$emit('open-shortcuts')"
          aria-label="快捷键帮助"
          title="快捷键帮助"
        >
          <i class="ri-question-line"></i>
        </button>

        <button
          type="button"
          class="app-header-btn"
          @click="$emit('open-settings')"
          aria-label="设置"
          title="设置"
        >
          <i class="ri-settings-line"></i>
        </button>

        <!-- 头像仅作展示，退出登录在设置面板中 -->
        <div class="app-header-avatar" :title="username">
          <img v-if="avatar" :src="avatar" alt="头像" />
          <template v-else>{{ usernameInitial }}</template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps({
  username: {
    type: String,
    default: '管理员'
  }
})

defineEmits(['open-settings', 'open-shortcuts'])

const settings = useSettingsStore()
const siteName = computed(() => settings.displayName)
const avatar = computed(() => settings.avatar)
const usernameInitial = computed(() => (props.username || 'N').charAt(0).toUpperCase())
</script>
