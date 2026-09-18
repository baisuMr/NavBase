<template>
  <a
    class="bookmark-card"
    :href="bookmark.url"
    target="_blank"
    rel="noopener noreferrer"
    @contextmenu.prevent="$emit('menu', $event)"
  >
    <span class="bookmark-card-favicon">
      <img v-if="bookmark.icon_url" :src="bookmark.icon_url" :alt="bookmark.title" loading="lazy" @error="hideImg" />
      <span v-else class="material-symbols-outlined" style="font-size:18px;color:var(--color-on-surface-variant)">link</span>
    </span>
    <span class="bookmark-card-info">
      <span class="bookmark-card-title">{{ bookmark.title }}</span>
      <span class="bookmark-card-domain">{{ domain }}</span>
    </span>
    <span class="bookmark-card-arrow">
      <span class="material-symbols-outlined">arrow_outward</span>
    </span>
  </a>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  bookmark: {
    type: Object,
    required: true
  }
})

defineEmits(['menu'])

const domain = computed(() => {
  try {
    return new URL(props.bookmark.url).hostname.replace(/^www\./, '')
  } catch {
    return props.bookmark.url
  }
})

function hideImg(e) {
  e.target.style.display = 'none'
}
</script>
