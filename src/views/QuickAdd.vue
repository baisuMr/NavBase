<template>
  <div ref="pageRef" class="quick-add-page" :class="{ 'quick-add-hidden': !windowReady }">
    <main ref="cardRef" class="quick-add-card">
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
      :seq="toast.seq"
      @close="hideToast"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
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
    // 成功页停留约 1 秒（可见反馈）后自动关闭书签栏弹窗；独立标签页 close 无效时成功页保留兜底
    setTimeout(() => window.close(), 1000)
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

// 弹窗窗口高度随内容自适应（书签栏 bookmarklet 固定宽 420 小窗），避免出现滚动条：
// 内容高 = 卡片上偏移（含 page 上内边距）+ 卡片自身高 + page 下内边距——
// 不用 documentElement.scrollHeight，body/.quick-add-page 的 min-height:100vh 会把它
// 顶在视口高度，内容变矮（成功页）时无法收缩、下方留白；
// 调整用 resizeBy 差值：resizeTo 绝对尺寸的 outer/inner 语义各浏览器不一，易多算窗口
// 边框；差值在两种语义下都恰好等于需求；
// 独立标签页打开时 resizeBy 被浏览器静默忽略，无副作用
let inflight = null // 未生效的 resizeBy 请求 { target, from }，同参去重防叠加
function fitWindow() {
  const page = pageRef.value
  const card = cardRef.value
  if (!page || !card) return false
  const paddingBottom = parseFloat(getComputedStyle(page).paddingBottom) || 0
  const target = card.offsetTop + card.offsetHeight + paddingBottom
  const from = window.innerHeight // 基数始终用实际视口：resizeBy 被钳制后自然重试补差
  if (target === from) return false
  if (inflight && inflight.target === target && inflight.from === from) return false
  inflight = { target, from }
  window.resizeBy(0, target - from)
  return true
}

const pageRef = ref(null)
const cardRef = ref(null)
// 数据就绪并完成一次性窗口调整前隐藏内容，避免渲染/调整过程的多轮跳动
const windowReady = ref(false)
let resizeObserver = null
let disposed = false // 卸载后中断 onMounted 续段（数据请求可能晚于离开完成）
let cancelSettle = null // 「等调整生效」的清理句柄

onMounted(async () => {
  // 初次数据（分类按钮参与高度）就绪前不显示；失败也照常继续，不卡白屏
  await Promise.all([
    fetchCategories().catch(() => {}),
    settingsStore.fetchSettings().catch(() => {})
  ])
  if (disposed) return
  // fetchSettings 的 applySettings 会写 document.title，须在其后覆盖为本页标题
  document.title = '快捷添加'
  await nextTick()
  if (disposed) return
  // 先挂监听再调整（resizeBy 同步生效也不丢事件），等调整生效再显示，避免展示后跳动；
  // 被浏览器忽略时超时兜底显示
  const settled = new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('resize', done)
      cancelSettle = null
      resolve()
    }
    const timer = setTimeout(done, 150)
    window.addEventListener('resize', done)
    cancelSettle = done
  })
  if (fitWindow()) await settled
  if (disposed) return
  windowReady.value = true
  // 显示后的动态变化（错误提示、成功页切换等）时跟随微调
  resizeObserver = new ResizeObserver(fitWindow)
  resizeObserver.observe(cardRef.value)
})

onUnmounted(() => {
  disposed = true
  cancelSettle?.()
  resizeObserver?.disconnect()
})
</script>
