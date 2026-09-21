<template>
  <div class="app">
    <!-- 顶栏 -->
    <AppHeader
      :username="username"
      @open-settings="settingsModal.visible = true"
      @add-bookmark="showBookmarkForm()"
    />

    <!-- 主区域 -->
    <main class="app-main">
      <!-- 第一屏：Hero -->
      <section id="startpage-hero" class="hero">
        <!-- 顶部行：问候 + 状态 -->
        <div class="hero-top-row">
          <div class="hero-greeting-pill">
            <span class="dot"></span>
            <span class="label">Focus Space</span>
            <span class="sep">•</span>
            <span class="text">{{ greeting }}</span>
          </div>
          <div class="hero-stats">
            <div class="hero-stats-item primary">
              <i class="ri-bookmark-line"></i>
              <span>书签 {{ bookmarks.length }}</span>
            </div>
            <span class="hero-stats-sep">•</span>
            <div class="hero-stats-item tertiary">
              <i class="ri-folder-line"></i>
              <span>分类 {{ categories.length }}</span>
            </div>
          </div>
        </div>

        <!-- 居中：时钟 + 搜索 -->
        <HeroClock />
        <HeroSearch
          ref="heroSearchRef"
          :bookmarks="bookmarks"
          :username="username"
        />

        <!-- 底部：分类宫格 -->
        <HeroCategoryCards
          :categories="heroCategories"
          @select="scrollToCategory"
          @category-menu="showCategoryMenu"
        />

        <!-- 滚动提示 -->
        <a class="hero-scroll-hint" href="#explorer-section">
          <span>向下滑动浏览全部书签</span>
          <i class="ri-arrow-down-double-line"></i>
        </a>
      </section>

      <!-- 第二屏：书签资源库 -->
      <BookmarkExplorer
        :bookmarks="bookmarks"
        :categories="explorerCategories"
        :active-cat="activeCategory"
        :filter-text="filterText"
        @update:filter-text="filterText = $event"
        @add-bookmark="showBookmarkForm()"
        @add-category="showCategoryForm()"
        @select-category="scrollToCategory"
        @category-menu="showCategoryMenu"
        @menu="showBookmarkMenu"
      />

      <!-- 加载状态 -->
      <div v-if="bookmarksLoading && bookmarks.length === 0" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载书签中…</span>
      </div>
    </main>

    <!-- 底部信息栏 -->
    <footer class="app-footer">
      <div class="app-footer-inner">
        <div class="app-footer-meta">
          <span>NavManager</span>
          <span class="app-footer-meta-dot">•</span>
          <span>{{ bookmarks.length }} 书签 · {{ categories.length }} 分类</span>
        </div>
        <div class="app-footer-links">
          <a href="#" @click.prevent="showCategoryForm()">分类管理</a>
        </div>
      </div>
    </footer>

    <!-- 右键菜单 -->
    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="onMenuSelect"
      @close="hideContextMenu"
    />

    <!-- 分类表单弹窗 -->
    <Modal
      v-if="categoryModal.visible"
      :title="categoryModal.data ? '编辑分类' : '新建分类'"
      @close="categoryModal.visible = false"
    >
      <CategoryForm
        :category="categoryModal.data"
        :colors="presetColors"
        :icons="presetIcons"
        :loading="categoryModal.loading"
        @submit="handleCategorySubmit"
        @cancel="categoryModal.visible = false"
      />
    </Modal>

    <!-- 书签表单弹窗 -->
    <Modal
      v-if="bookmarkModal.visible"
      :title="bookmarkModal.data ? '编辑书签' : '新建书签'"
      @close="bookmarkModal.visible = false"
    >
      <BookmarkForm
        :bookmark="bookmarkModal.data"
        :categories="categories"
        :loading="bookmarkModal.loading"
        @submit="handleBookmarkSubmit"
        @cancel="bookmarkModal.visible = false"
      />
    </Modal>

    <!-- 设置面板 -->
    <SettingsPanel
      v-if="settingsModal.visible"
      @close="settingsModal.visible = false"
    />

    <!-- Toast -->
    <ToastMessage
      v-if="toast.visible"
      :message="toast.message"
      :type="toast.type"
      @close="hideToast"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

import AppHeader from '../components/layout/AppHeader.vue'
import HeroClock from '../components/hero/HeroClock.vue'
import HeroSearch from '../components/hero/HeroSearch.vue'
import HeroCategoryCards from '../components/hero/HeroCategoryCards.vue'
import BookmarkExplorer from '../components/bookmark/BookmarkExplorer.vue'
import BookmarkForm from '../components/bookmark/BookmarkForm.vue'
import CategoryForm from '../components/category/CategoryForm.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import Modal from '../components/common/Modal.vue'
import SettingsPanel from '../components/common/SettingsPanel.vue'
import ToastMessage from '../components/common/ToastMessage.vue'

import { useBookmarks } from '../composables/useBookmarks'
import { useCategories } from '../composables/useCategories'
import { useAuth } from '../composables/useAuth'
import { useContextMenu } from '../composables/useContextMenu'
import { useKeyboard } from '../composables/useKeyboard'
import { useToast } from '../composables/useToast'
import { useDateInfo } from '../composables/useLunar'
import { useSettingsStore } from '../stores/settings'
import { CATEGORY_ICONS, resolveCategoryIcon } from '../constants/categoryIcons'

const settingsStore = useSettingsStore()

// ── 预设数据 ──
const presetColors = [
  { name: '翡翠', value: '#10b981' },
  { name: '靛蓝', value: '#4F46E5' },
  { name: '紫色', value: '#7C3AED' },
  { name: '粉色', value: '#DB2777' },
  { name: '红色', value: '#DC2626' },
  { name: '橙色', value: '#EA580C' },
  { name: '琥珀', value: '#F59E0B' },
  { name: '青色', value: '#0D9488' },
  { name: '蓝色', value: '#2563EB' },
  { name: '灰色', value: '#6B7280' }
]

const presetIcons = CATEGORY_ICONS

// ── 组合式函数 ──
const { bookmarks, loading: bookmarksLoading, fetchBookmarks, createBookmark, updateBookmark, deleteBookmark } = useBookmarks()
const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategories()
const { username } = useAuth()
const { contextMenu, showContextMenu, hideContextMenu, handleMenuSelect } = useContextMenu()
const { toast, showToast, hideToast, success, error: showError } = useToast()
const { getGreeting } = useDateInfo()

// ── 本地状态 ──
const heroSearchRef = ref(null)
const activeCategory = ref('all')
const filterText = ref('')
const greeting = ref(getGreeting())

const categoryModal = ref({ visible: false, data: null, loading: false })
const bookmarkModal = ref({ visible: false, data: null, loading: false })
const settingsModal = ref({ visible: false })

// ── 计算属性 ──

// 每个分类下的书签数量
const categoryCountMap = computed(() => {
  const map = {}
  categories.value.forEach(c => { map[c.id] = 0 })
  bookmarks.value.forEach(b => {
    if (b.category_id && map[b.category_id] !== undefined) map[b.category_id]++
  })
  return map
})

// Hero 分类卡片：按书签数量取前 5 个分类 + "全部"（同数量时保持 sort_order 次序）
const heroCategories = computed(() => {
  const all = {
    id: 'all',
    name: '全部',
    icon: 'ri-apps-2-line',
    count: bookmarks.value.length,
    accent: 'primary'
  }
  const list = [...categories.value]
    .sort((a, b) => (categoryCountMap.value[b.id] || 0) - (categoryCountMap.value[a.id] || 0))
    .slice(0, 5)
    .map((c, idx) => ({
      id: c.id,
      name: c.name,
      icon: resolveCategoryIcon(c.icon),
      count: categoryCountMap.value[c.id] || 0,
      accent: accentForIndex(idx)
    }))
  return [all, ...list]
})

// Explorer 分类 pills
const explorerCategories = computed(() => {
  return categories.value.map(c => ({
    id: c.id,
    name: c.name,
    count: categoryCountMap.value[c.id] || 0
  }))
})

function accentForIndex(idx) {
  const accents = ['primary', 'secondary', 'primary', 'tertiary', 'neutral']
  return accents[idx % accents.length]
}

// ── 时间问候 ──
let timer = null
function tick() {
  greeting.value = getGreeting()
}

// ── 快捷键 ──
useKeyboard({
  search: () => heroSearchRef.value?.focus(),
  addBookmark: () => showBookmarkForm(),
  addCategory: () => showCategoryForm(),
  close: () => {
    categoryModal.value.visible = false
    bookmarkModal.value.visible = false
    settingsModal.value.visible = false
    hideContextMenu()
  }
})

// ── 滚动定位 ──
function scrollToCategory(id) {
  activeCategory.value = id
  const el = document.getElementById('explorer-section')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── 右键菜单 ──
function showBookmarkMenu(event, bookmark) {
  showContextMenu(event, [
    { icon: 'ri-edit-line', label: '编辑', action: 'edit-bookmark' },
    { icon: 'ri-file-copy-line', label: '复制链接', action: 'copy-link' },
    { divider: true },
    { icon: 'ri-delete-bin-line', label: '删除', action: 'delete-bookmark', danger: true }
  ], bookmark)
}

function showCategoryMenu(event, category) {
  showContextMenu(event, [
    { icon: 'ri-edit-line', label: '编辑分类', action: 'edit-category' },
    { divider: true },
    { icon: 'ri-delete-bin-line', label: '删除分类', action: 'delete-category', danger: true }
  ], category)
}

async function onMenuSelect(action) {
  const { action: menuAction, target } = handleMenuSelect(action)
  if (!target) return
  switch (menuAction) {
    case 'edit-bookmark':
      showBookmarkForm(target)
      break
    case 'copy-link':
      try {
        await navigator.clipboard.writeText(target.url)
        success('链接已复制')
      } catch {
        showError('复制失败')
      }
      break
    case 'delete-bookmark':
      if (confirm(`确定要删除「${target.title}」吗？`)) {
        try {
          await deleteBookmark(target.id)
          success('书签已删除')
        } catch (err) {
          showError('删除失败: ' + err.message)
        }
      }
      break
    case 'edit-category': {
      // explorer 传出的对象只含 id/name/count，编辑表单需要完整的分类数据
      const full = categories.value.find(c => c.id === target.id)
      if (full) showCategoryForm(full)
      break
    }
    case 'delete-category':
      if (confirm(`确定删除分类「${target.name}」吗？分类下的书签将变为未分类。`)) {
        try {
          await deleteCategory(target.id)
          if (activeCategory.value === target.id) activeCategory.value = 'all'
          success('分类已删除')
        } catch (err) {
          showError('删除失败: ' + err.message)
        }
      }
      break
  }
}

// ── 表单 ──
function showCategoryForm(data = null) { categoryModal.value = { visible: true, data, loading: false } }
function showBookmarkForm(data = null) { bookmarkModal.value = { visible: true, data, loading: false } }

async function handleCategorySubmit(formData) {
  categoryModal.value.loading = true
  try {
    if (categoryModal.value.data) {
      await updateCategory(categoryModal.value.data.id, formData)
      success('分类已更新')
    } else {
      await createCategory(formData)
      success('分类已创建')
    }
    categoryModal.value.visible = false
  } catch (err) {
    showError('操作失败: ' + err.message)
  } finally {
    categoryModal.value.loading = false
  }
}

async function handleBookmarkSubmit(formData) {
  bookmarkModal.value.loading = true
  try {
    if (bookmarkModal.value.data) {
      await updateBookmark(bookmarkModal.value.data.id, formData)
      success('书签已更新')
    } else {
      await createBookmark(formData)
      success('书签已创建')
    }
    bookmarkModal.value.visible = false
  } catch (err) {
    showError('操作失败: ' + err.message)
  } finally {
    bookmarkModal.value.loading = false
  }
}

// ── 生命周期 ──
onMounted(async () => {
  tick()
  timer = setInterval(tick, 60000)
  await Promise.all([fetchBookmarks(), fetchCategories(), settingsStore.fetchSettings()])
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
