<template>
  <div class="quick-add-page">
    <main class="quick-add-card">
      <!-- 成功态 -->
      <div v-if="saved" class="quick-add-done">
        <i class="ri-check-line"></i>
        <h1>书签已添加</h1>
        <p>可以关闭本窗口，继续浏览原网页</p>
        <button type="button" class="btn btn-primary" @click="closeWindow">关闭窗口</button>
      </div>

      <!-- 表单态 -->
      <template v-else>
        <header class="quick-add-header">
          <span class="quick-add-logo">{{ settingsStore.displayName }}</span>
          <h1>快捷添加书签</h1>
        </header>
        <BookmarkForm
          :bookmark="prefill"
          :categories="categories"
          :loading="loading"
          @submit="handleSubmit"
          @cancel="closeWindow"
        />
      </template>
    </main>

    <ToastMessage
      v-if="toast.visible"
      :message="toast.message"
      :type="toast.type"
      @close="hideToast"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import BookmarkForm from '../components/bookmark/BookmarkForm.vue'
import ToastMessage from '../components/common/ToastMessage.vue'
import { useBookmarks } from '../composables/useBookmarks'
import { useCategories } from '../composables/useCategories'
import { useToast } from '../composables/useToast'
import { useSettingsStore } from '../stores/settings'

const route = useRoute()
const settingsStore = useSettingsStore()
const { createBookmark } = useBookmarks()
const { categories, fetchCategories } = useCategories()
const { toast, hideToast, error: showError } = useToast()

const loading = ref(false)
const saved = ref(false)

// 书签栏脚本采集的 url/title/desc 经 query 预填表单
const prefill = computed(() => ({
  url: typeof route.query.url === 'string' ? route.query.url : '',
  title: typeof route.query.title === 'string' ? route.query.title : '',
  description: typeof route.query.desc === 'string' ? route.query.desc : ''
}))

async function handleSubmit(formData) {
  loading.value = true
  try {
    await createBookmark(formData)
    saved.value = true
  } catch (err) {
    showError('保存失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

// 书签栏弹窗场景可直接关闭；独立标签页时 window.close 无效，静默即可
function closeWindow() {
  window.close()
}

onMounted(async () => {
  fetchCategories()
  // fetchSettings 的 applySettings 会写 document.title，须在其后覆盖为本页标题
  await settingsStore.fetchSettings()
  document.title = '快捷添加'
})
</script>
