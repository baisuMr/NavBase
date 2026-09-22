<template>
  <section id="explorer-section" class="explorer">
    <!-- 工具栏：分类 tabs + 添加 -->
    <div class="explorer-toolbar">
      <div class="category-tabs">
        <button
          type="button"
          class="category-tab"
          :class="{ active: activeCat === 'all' }"
          @click="$emit('select-category', 'all')"
        >
          <span>全部</span>
          <span class="category-tab-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="category-tab"
          :class="{ active: activeCat === cat.id }"
          :style="activeCat === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : null"
          @click="$emit('select-category', cat.id)"
          @contextmenu.prevent="$emit('category-menu', $event, cat)"
        >
          <!-- 分类图标：未激活用分类色，激活继承白色文字色 -->
          <i
            v-if="cat.icon"
            :class="cat.icon"
            :style="activeCat !== cat.id ? { color: cat.color } : null"
          ></i>
          <span>{{ cat.name }}</span>
          <span class="category-tab-count">{{ cat.count }}</span>
        </button>
        <button
          type="button"
          class="category-tab-add"
          @click="$emit('add-category')"
          aria-label="新建分类"
          title="新建分类"
        >
          <i class="ri-add-line"></i>
        </button>
      </div>

      <button class="explorer-add-btn" type="button" @click="$emit('add-bookmark')">
        <i class="ri-add-line"></i>
        <span>添加网址</span>
      </button>
    </div>

    <!-- 网格 -->
    <div class="bookmark-grid">
      <template v-if="visibleBookmarks.length > 0">
        <BookmarkCard
          v-for="bm in visibleBookmarks"
          :key="bm.id"
          :bookmark="bm"
          @menu="$emit('menu', $event, bm)"
        />
      </template>
      <div v-else class="bookmark-empty">
        <i class="ri-bookmark-line"></i>
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
  }
})

defineEmits(['add-bookmark', 'add-category', 'select-category', 'category-menu', 'menu'])

const totalCount = computed(() => props.bookmarks.length)

const visibleBookmarks = computed(() => {
  if (props.activeCat === 'all') return props.bookmarks
  return props.bookmarks.filter(b => b.category_id === props.activeCat)
})

const emptyText = computed(() => {
  if (props.activeCat !== 'all') return '该分类下暂无书签'
  return '暂无书签，点击右上角「添加网址」添加'
})
</script>
