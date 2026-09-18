<template>
  <div class="hero-categories">
    <a
      v-for="cat in categories"
      :key="cat.id || 'all'"
      href="#explorer-section"
      class="hero-category-card"
      :class="cat.accent"
      @click.prevent="$emit('select', cat.id)"
      @contextmenu="onContextMenu($event, cat)"
    >
      <div class="hero-category-card-left">
        <span class="hero-category-icon">
          <span class="material-symbols-outlined">{{ cat.icon }}</span>
        </span>
        <span class="hero-category-name">{{ cat.name }}</span>
      </div>
      <span class="hero-category-count">{{ cat.count }}</span>
    </a>
  </div>
</template>

<script setup>
defineProps({
  categories: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['select', 'category-menu'])

// 「全部」是虚拟卡片不可管理，仅真实分类响应右键菜单
function onContextMenu(event, cat) {
  if (cat.id === 'all') return
  event.preventDefault()
  emit('category-menu', event, cat)
}
</script>
