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
      <div v-if="urlError" class="form-error" role="alert">{{ urlError }}</div>
      <div v-else class="form-hint">输入网址后将自动获取网站图标</div>
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
          {{ cat.name }}
        </option>
      </select>
    </div>

    <div v-if="iconPreview && !iconPreviewFailed" class="form-group">
      <label class="form-label">图标预览</label>
      <div class="form-hint form-icon-preview-row">
        <img
          :src="iconPreview"
          :alt="form.title"
          class="form-icon-preview"
          @error="iconPreviewFailed = true"
        />
        <span>保存后自动加载网站图标</span>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">取消</button>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? '保存中…' : '保存书签' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { isAllowedUrl } from '../../utils/url'
import { getFaviconKey } from '../../utils/faviconKey'

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
  category_id: null
})

watch(() => props.bookmark, (val) => {
  if (val) {
    Object.assign(form, {
      url: val.url || '',
      title: val.title || '',
      description: val.description || '',
      category_id: val.category_id || null
    })
  }
}, { immediate: true })

// 图标预览：走 /api/favicon 图片代理（带持证参数 k），与列表渲染同一管线；
// 探测在保存后的渲染阶段由代理统一完成，表单期不做额外网络请求
const iconPreviewFailed = ref(false)
const iconPreview = computed(() => {
  if (!isAllowedUrl(form.url)) return ''
  const k = getFaviconKey()
  if (!k) return ''
  try {
    const { hostname } = new URL(form.url)
    return `/api/favicon/${hostname.replace(/^www\./, '')}?k=${encodeURIComponent(k)}`
  } catch {
    return ''
  }
})

// 协议级错误提示：原生 type="url" 不校验协议，javascript: 等可提交到后端，前端先拦
const urlError = ref('')

watch(() => form.url, () => {
  iconPreviewFailed.value = false
  urlError.value = ''
})

function handleSubmit() {
  if (!isAllowedUrl(form.url)) {
    urlError.value = '仅支持 http/https 链接'
    return
  }
  emit('submit', { ...form })
}
</script>
