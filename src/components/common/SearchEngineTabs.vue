<template>
  <div class="engine-tabs scrollbar-none">
    <button
      v-for="engine in engines"
      :key="engine.id"
      type="button"
      class="engine-tab"
      :class="{ active: engine.id === currentId }"
      @click="$emit('select', engine.id)"
    >
      <span v-if="engine.id === currentId" class="engine-tab-dot"></span>
      <span>{{ engine.label }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  engines: {
    type: Array,
    required: true
  },
  currentId: {
    type: String,
    required: true
  }
})

defineEmits(['select'])
</script>
