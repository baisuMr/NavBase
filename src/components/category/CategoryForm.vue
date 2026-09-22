<template>
  <form @submit.prevent="handleSubmit">
    <div class="form-group">
      <label class="form-label">分类名称</label>
      <input
        v-model="form.name"
        type="text"
        class="input"
        placeholder="例如：日常工作"
        required
      />
    </div>

    <div class="form-group">
      <label class="form-label">图标</label>
      <IconPicker
        :icons="icons"
        :model-value="form.icon"
        @update:model-value="form.icon = $event"
      />
    </div>

    <div class="form-group">
      <label class="form-label">颜色</label>
      <ColorPicker
        :colors="colors"
        :model-value="form.color"
        @update:model-value="form.color = $event"
      />
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">取消</button>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? '保存中…' : '保存分类' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { reactive, watch } from 'vue'
import IconPicker from '../common/IconPicker.vue'
import ColorPicker from '../common/ColorPicker.vue'

const props = defineProps({
  category: { type: Object, default: null },
  colors: { type: Array, required: true },
  icons: { type: Array, required: true },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({
  name: '',
  icon: 'ri-folder-line',
  color: '#10b981'
})

watch(() => props.category, (val) => {
  if (val) {
    Object.assign(form, {
      name: val.name || '',
      icon: val.icon || 'ri-folder-line',
      color: val.color || '#10b981'
    })
  }
}, { immediate: true })

function handleSubmit() {
  emit('submit', { ...form })
}
</script>
