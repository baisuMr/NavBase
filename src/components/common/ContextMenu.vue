<template>
  <div
    class="context-menu-overlay"
    @click="$emit('close')"
    @contextmenu.prevent="$emit('close')"
  >
    <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }" @click.stop>
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item.divider" class="context-menu-divider" />
        <div
          v-else
          class="context-menu-item"
          :class="{ danger: item.danger }"
          @click="$emit('select', item.action)"
        >
          <i v-if="item.icon" :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  items: { type: Array, required: true }
})

defineEmits(['select', 'close'])
</script>
