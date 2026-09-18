<template>
  <div class="hero-categories">
    <a
      v-for="cat in categories"
      :key="cat.id || 'all'"
      href="#explorer-section"
      class="hero-category-card"
      :class="cat.accent"
      @click.prevent="$emit('select', cat.id)"
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

defineEmits(['select'])
</script>
