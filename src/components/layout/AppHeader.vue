<template>
  <header class="app-header">
    <div class="app-header-inner">
      <!-- 左侧：品牌 + 导航 -->
      <div style="display:flex;align-items:center;gap:var(--space-lg);">
        <a class="app-header-brand" href="#startpage-hero">
          <span class="material-symbols-outlined">bookmark_heart</span>
          <span class="app-header-brand-text">
            <span class="app-header-brand-name">Atelier</span>
            <span class="app-header-brand-tag">栞记</span>
          </span>
        </a>

        <nav class="app-header-nav" aria-label="主导航">
          <a class="app-header-nav-link active" href="#startpage-hero">Overview</a>
          <a class="app-header-nav-link" href="#explorer-section">Collections</a>
        </nav>
      </div>

      <!-- 右侧：搜索触发 + 添加 + 头像 -->
      <div class="app-header-actions">
        <button
          type="button"
          class="app-header-search-trigger"
          @click="$emit('focus-search')"
          aria-label="聚焦搜索"
        >
          <span class="material-symbols-outlined">search</span>
          <span>Search marks &amp; web...</span>
          <kbd>Ctrl K</kbd>
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

        <button
          type="button"
          class="app-header-avatar"
          @click="$emit('logout')"
          aria-label="退出登录"
          :title="`退出登录 (${username})`"
        >
          <span class="material-symbols-outlined">person</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  username: {
    type: String,
    default: '管理员'
  }
})

defineEmits(['focus-search', 'add-bookmark', 'logout'])
</script>
