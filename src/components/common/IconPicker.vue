<template>
  <div class="icon-picker">
    <div
      v-for="icon in icons"
      :key="icon"
      class="icon-item"
      :class="{ active: modelValue === icon }"
      @click="$emit('update:modelValue', icon)"
    >
      <i :class="icon"></i>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icons: {
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
