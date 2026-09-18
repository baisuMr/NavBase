<template>
  <section id="explorer-section" class="explorer">
    <!-- 标题 -->
    <div class="explorer-header">
      <div class="explorer-header-left">
        <div class="explorer-header-icon">
          <span class="material-symbols-outlined">bookmarks</span>
        </div>
        <div>
          <h2 class="explorer-title">书签资料库</h2>
          <p class="explorer-subtitle">优雅收纳、多维分类与毫秒检索的极简书签矩阵</p>
        </div>
      </div>
      <div class="explorer-status">
        <span class="dot"></span>
        <span>共 {{ totalCount }} 条目</span>
      </div>
    </div>

    <!-- 工具栏：搜索 + 添加 -->
    <div class="explorer-toolbar">
      <div class="explorer-filter">
        <span class="material-symbols-outlined">filter_alt</span>
        <input
          :value="filterText"
          type="text"
          class="input"
          :placeholder="`在 ${totalCount} 个书签中按标题或域名筛选...`"
          @input="$emit('update:filter-text', $event.target.value)"
        />
      </div>
      <div style="display:flex;gap:var(--space-sm,8px);">
        <button class="explorer-add-btn" type="button" @click="$emit('import-bookmarks')">
          <span class="material-symbols-outlined">upload</span>
          <span>导入书签</span>
        </button>
        <button class="explorer-add-btn" type="button" @click="$emit('add-bookmark')">
          <span class="material-symbols-outlined">add</span>
          <span>添加新书签</span>
        </button>
      </div>
    </div>

    <!-- 分类 pills -->
    <div class="category-pills scrollbar-none">
      <button
        type="button"
        class="category-pill"
        :class="{ active: activeCat === 'all' }"
        @click="$emit('select-category', 'all')"
      >
        <span>全部书签</span>
        <span class="category-pill-count">{{ totalCount }}</span>
      </button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="category-pill"
        :class="{ active: activeCat === cat.id }"
        @click="$emit('select-category', cat.id)"
        @contextmenu.prevent="$emit('category-menu', $event, cat)"
      >
        <span>{{ cat.name }}</span>
        <span class="category-pill-count">{{ cat.count }}</span>
      </button>
    </div>

    <!-- 网格 -->
    <div v-if="visibleBookmarks.length > 0" class="bookmark-grid">
      <BookmarkCard
        v-for="bm in visibleBookmarks"
        :key="bm.id"
        :bookmark="bm"
        @menu="$emit('menu', $event, bm)"
      />
    </div>
    <div v-else class="bookmark-grid">
      <div class="bookmark-empty">
        <span class="material-symbols-outlined">bookmarks</span>
        <div>{{ emptyText }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import BookmarkCard from './BookmarkCard.vue'

const props = defineProps({
  bookmarks: {
    type: Array,
    required: true
  },
  categories: {
    type: Array,
    required: true
  },
  activeCat: {
    type: [String, Number],
    default: 'all'
  },
  filterText: {
    type: String,
    default: ''
  }
})

defineEmits(['add-bookmark', 'import-bookmarks', 'select-category', 'category-menu', 'menu', 'update:filter-text'])

const totalCount = computed(() => props.bookmarks.length)

const visibleBookmarks = computed(() => {
  let list = props.bookmarks
  if (props.activeCat !== 'all') {
    list = list.filter(b => b.category_id === props.activeCat)
  }
  const q = props.filterText.trim().toLowerCase()
  if (q) {
    list = list.filter(b =>
      b.title.toLowerCase().includes(q) ||
      (b.url || '').toLowerCase().includes(q)
    )
  }
  return list
})

const emptyText = computed(() => {
  if (props.filterText.trim()) return '没有匹配的书签'
  if (props.activeCat !== 'all') return '该分类下暂无书签'
  return '暂无书签，点击右上角或第一屏的 + 添加'
})
</script>
