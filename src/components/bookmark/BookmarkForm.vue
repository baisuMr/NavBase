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
        @blur="fetchFavicon"
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

    <div v-if="form.icon_url" class="form-group">
      <label class="form-label">图标预览</label>
      <div class="form-hint" style="display:flex;align-items:center;gap:var(--space-sm);">
        <img
          :src="form.icon_url"
          :alt="form.title"
          style="width:32px;height:32px;border-radius:var(--radius-sm);object-fit:contain;background:var(--color-surface-container-highest);padding:4px;"
          @error="form.icon_url = ''"
        />
        <span>已自动获取</span>
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
import { reactive, watch } from 'vue'
import { api } from '../../api'

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

async function fetchFavicon() {
  if (!form.url || !/^https?:\/\//i.test(form.url)) return
  try {
    const { hostname } = new URL(form.url)
    // 必须走带认证头的 api 封装，裸 fetch 会被中间件 401 拦截
    const { url } = await api.get(`/favicon/${hostname}`)
    if (url) form.icon_url = url
  } catch {
    // 静默失败（401 由 api 层统一处理跳转登录）
  }
}

function handleSubmit() {
  emit('submit', { ...form })
}
</script>
