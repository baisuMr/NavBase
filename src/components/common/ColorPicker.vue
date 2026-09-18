<template>
  <div class="color-picker">
    <div
      v-for="color in colors"
      :key="color.value"
      class="color-item"
      :class="{ active: modelValue === color.value }"
      :style="{ backgroundColor: color.value }"
      :title="color.name"
      @click="$emit('update:modelValue', color.value)"
    />
  </div>
</template>

<script setup>
defineProps({
  colors: {
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
