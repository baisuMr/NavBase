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
        @blur="fetchMeta"
      />
      <div v-if="urlError" class="form-error" role="alert">{{ urlError }}</div>
      <div v-else class="form-hint">{{ metaHint || '输入网址后将自动获取网站图标、标题与描述' }}</div>
    </div>

    <div class="form-group">
      <label class="form-label">网站名称</label>
      <input
        v-model="form.title"
        type="text"
        class="input"
        placeholder="例如：GitHub 开源社区"
        required
        :disabled="metaFetching"
      />
    </div>

    <div class="form-group">
      <label class="form-label">描述（可选）</label>
      <textarea
        v-model="form.description"
        class="textarea"
        placeholder="一句话描述这个站点..."
        rows="2"
        :disabled="metaFetching"
      ></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">所属分类</label>
      <div class="category-picker" role="group" aria-label="所属分类">
        <button
          type="button"
          class="category-option"
          :class="{ active: form.category_id === null }"
          :aria-pressed="form.category_id === null"
          @click="form.category_id = null"
        >未分类</button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="category-option"
          :class="{ active: form.category_id === cat.id }"
          :style="{ '--cat-color': cat.color }"
          :title="cat.name"
          :aria-pressed="form.category_id === cat.id"
          @click="form.category_id = cat.id"
        >{{ cat.name }}</button>
      </div>
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
import { faviconSrc } from '../../composables/useFavicon'
import { pageMetaApi } from '../../api/pageMeta'

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
// 探测由代理统一完成并缓存，保存后列表渲染直接复用
const iconPreviewFailed = ref(false)
const iconPreview = computed(() => {
  if (!isAllowedUrl(form.url)) return ''
  return faviconSrc(form.url)
})

// 协议级错误提示：原生 type="url" 不校验协议，javascript: 等可提交到后端，前端先拦
const urlError = ref('')

// 自动获取标题/描述：URL 失焦触发，获取中禁用名称/描述输入，只填空字段
const metaFetching = ref(false)
const metaHint = ref('')
const metaDoneUrl = ref('') // 成功获取过标题的 URL，再次失焦不重复请求（失败可重试）
let metaAbort = null
let metaFetchUrl = '' // 在途获取对应的 URL（中止判断用）
let metaTimedOut = false
const META_TIMEOUT_MS = 15000 // 与 api 层默认请求超时一致，防弱网下获取状态永久悬挂

// 中止在途获取并复位状态（获取中 URL 变更时调用）
function resetMetaFetch() {
  if (metaAbort) {
    metaAbort.abort()
    metaAbort = null
  }
  metaFetchUrl = ''
  if (metaFetching.value) {
    metaFetching.value = false
    metaHint.value = ''
  }
}

async function fetchMeta() {
  if (!isAllowedUrl(form.url)) return
  if (form.url === metaDoneUrl.value) return
  // 只填空字段：名称与描述都已有内容时无事可做，也不必发起请求
  if (form.title && form.description) return
  resetMetaFetch()
  const ctl = new AbortController()
  metaAbort = ctl
  metaFetchUrl = form.url
  metaTimedOut = false
  const timer = setTimeout(() => {
    metaTimedOut = true
    ctl.abort()
  }, META_TIMEOUT_MS)
  metaFetching.value = true
  metaHint.value = '正在获取网站信息…'
  try {
    const data = await pageMetaApi.get(form.url, ctl.signal)
    if (ctl.signal.aborted) return
    if (!form.title && data.title) form.title = data.title
    if (!form.description && data.description) form.description = data.description
    if (data.title) {
      metaDoneUrl.value = form.url
      metaHint.value = ''
    } else {
      metaHint.value = '未能识别标题，请手动填写'
    }
  } catch {
    // 主动中止（URL 变更）静默；超时/网络失败提示手动填写
    if (ctl.signal.aborted && !metaTimedOut) return
    metaHint.value = '自动获取失败，请手动填写'
  } finally {
    clearTimeout(timer)
    if (metaAbort === ctl) {
      metaAbort = null
      metaFetchUrl = ''
      metaFetching.value = false
    }
  }
}

watch(() => form.url, () => {
  iconPreviewFailed.value = false
  urlError.value = ''
  // 仅当 URL 相对在途获取已变化才中止解禁；
  // watcher 在下个 tick 冲刷，「同一刻输入→失焦」发起的获取不能被误杀
  if (metaFetching.value && form.url !== metaFetchUrl) resetMetaFetch()
})

function handleSubmit() {
  if (!isAllowedUrl(form.url)) {
    urlError.value = '仅支持 http/https 链接'
    return
  }
  emit('submit', { ...form })
}
</script>
