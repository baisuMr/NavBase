<template>
  <form @submit.prevent="handleSubmit">
    <div class="form-group">
      <label class="form-label">网页 URL</label>
      <input
        v-model="form.url"
        type="url"
        class="input"
        placeholder="https://example.com"
        required
      />
      <div class="form-hint">输入网址后将自动获取网站图标</div>
    </div>

    <div class="form-group">
      <label class="form-label">网站名称</label>
      <input
        v-model="form.title"
        type="text"
        class="input"
        placeholder="例如：GitHub 开源社区"
        required
      />
    </div>

    <div class="form-group">
      <label class="form-label">描述（可选）</label>
      <textarea
        v-model="form.description"
        class="textarea"
        placeholder="一句话描述这个站点..."
        rows="2"
      ></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">所属分类</label>
      <select v-model="form.category_id" class="select">
        <option :value="null">未分类</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
          {{ cat.icon }} {{ cat.name }}
        </option>
      </select>
    </div>

    <div v-if="iconPreview && !iconPreviewFailed" class="form-group">
      <label class="form-label">图标预览</label>
      <div class="form-hint" style="display:flex;align-items:center;gap:var(--space-sm);">
        <img
          :src="iconPreview"
          :alt="form.title"
          style="width:32px;height:32px;border-radius:var(--radius-sm);object-fit:contain;background:var(--color-surface-container-highest);padding:4px;"
          @error="iconPreviewFailed = true"
        />
        <span>保存后自动加载网站图标</span>
      </div>
    </div>

    <div class="modal-footer" style="padding-left:0;padding-right:0;">
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">取消</button>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? '保存中…' : '保存书签' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'

const props = defineProps({
  bookmark: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({
  url: '',
  title: '',
  description: '',
  category_id: null,
  icon_url: ''
})

watch(() => props.bookmark, (val) => {
  if (val) {
    Object.assign(form, {
      url: val.url || '',
      title: val.title || '',
      description: val.description || '',
      category_id: val.category_id || null,
      icon_url: val.icon_url || ''
    })
  }
}, { immediate: true })

// 图标预览：icon_url 已有（编辑）优先，否则走 /api/favicon 图片代理；
// 探测在保存后的渲染阶段由代理统一完成，表单期不做网络请求
const iconPreviewFailed = ref(false)
const iconPreview = computed(() => {
  if (!form.url || !/^https?:\/\//i.test(form.url)) return ''
  try {
    const { hostname } = new URL(form.url)
    return form.icon_url || `/api/favicon/${hostname.replace(/^www\./, '')}`
  } catch {
    return ''
  }
})

watch(() => form.url, () => { iconPreviewFailed.value = false })

function handleSubmit() {
  emit('submit', { ...form })
}
</script>
