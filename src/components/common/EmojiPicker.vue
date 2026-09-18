<template>
  <div class="emoji-picker">
    <div
      v-for="emoji in emojis"
      :key="emoji"
      class="emoji-item"
      :class="{ active: modelValue === emoji }"
      @click="$emit('update:modelValue', emoji)"
    >
      {{ emoji }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  emojis: {
    type: Array,
    required: true
  },
  modelValue: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue'])
</script>
