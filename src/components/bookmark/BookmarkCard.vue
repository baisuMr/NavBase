<template>
  <a
    class="bookmark-card"
    :href="bookmark.url"
    target="_blank"
    rel="noopener noreferrer"
    @contextmenu.prevent="$emit('menu', $event)"
  >
    <span class="bookmark-card-favicon">
      <img v-if="iconSrc(bookmark)" :src="iconSrc(bookmark)" :alt="bookmark.title" loading="lazy" @error="onIconError(bookmark)" />
      <span v-else class="favicon-fallback">{{ iconInitial(bookmark) }}</span>
    </span>
    <span class="bookmark-card-info">
      <span class="bookmark-card-title">{{ bookmark.title }}</span>
      <span class="bookmark-card-domain">{{ domain }}</span>
    </span>
    <span class="bookmark-card-arrow">
      <i class="ri-external-link-line"></i>
    </span>
  </a>
</template>

<script setup>
import { computed } from 'vue'

import { useFavicon } from '../../composables/useFavicon'

const props = defineProps({
  bookmark: {
    type: Object,
    required: true
  }
})

defineEmits(['menu'])

const { iconSrc, onIconError, iconInitial } = useFavicon()

const domain = computed(() => {
  try {
    return new URL(props.bookmark.url).hostname.replace(/^www\./, '')
  } catch {
    return props.bookmark.url
  }
})
</script>
