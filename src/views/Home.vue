<template>
  <div>
    <!-- 顶栏 -->
    <AppHeader
      :username="username"
      @open-settings="settingsModal.visible = true"
      @open-shortcuts="shortcutModal.visible = true"
    />

    <main>
      <!-- 第一屏：时钟 + 搜索 + 常用站点 -->
      <section id="startpage-hero" class="hero">
        <div class="hero-content">
          <!-- 时钟 -->
          <div class="hero-clock">
            <span class="hero-clock-hm">{{ hhmm }}</span>
            <span class="hero-clock-sec">:{{ ss }}</span>
          </div>

          <!-- 日期行 -->
          <div class="hero-meta">
            <span class="hero-meta-date">{{ gregorianText }}</span>
            <span class="badge badge-primary">{{ weekdayText }}</span>
            <span class="hero-meta-dot">•</span>
            <span>{{ lunarText }}</span>
            <span class="hero-meta-dot">•</span>
            <span class="badge badge-mono">第 {{ weekOfYear }} 周</span>
          </div>

          <!-- 搜索 -->
          <form class="hero-search" @submit.prevent="onSearchSubmit">
            <div class="hero-search-box">
              <div class="hero-search-engine-wrap">
                <button
                  type="button"
                  class="hero-search-engine"
                  :aria-expanded="engineMenuOpen"
                  @click="toggleEngineMenu"
                >
                  <span class="hero-search-engine-dot"></span>
                  <span>{{ currentEngineLabel }}</span>
                  <i class="ri-arrow-down-s-line"></i>
                </button>
                <div
                  v-if="engineMenuOpen"
                  class="hero-search-engine-menu"
                  @mousedown.prevent
                >
                  <button
                    v-for="engine in engines"
                    :key="engine.id"
                    type="button"
                    class="hero-search-engine-item"
                    :class="{ active: engine.id === currentEngineId }"
                    @click="selectEngine(engine.id)"
                  >
                    {{ engine.label }}
                  </button>
                </div>
              </div>

              <div class="hero-search-field">
                <i class="ri-search-line"></i>
                <input
                  ref="searchInput"
                  v-model="query"
                  type="text"
                  class="hero-search-input"
                  placeholder="键入关键词或网页链接，按下 Enter 立即检索..."
                  autocomplete="off"
                  @input="onSearchInput"
                  @focus="onSearchFocus"
                  @blur="onSearchBlur"
                />
              </div>

              <div class="hero-search-kbd">
                <span class="kbd">Ctrl</span>
                <span class="kbd">K</span>
              </div>
            </div>

            <!-- 站内结果下拉 -->
            <div
              v-if="showDropdown && (internalResults.length > 0 || showEngineHint)"
              class="hero-search-results"
              @mousedown.prevent
            >
              <a
                v-for="bm in internalResults"
                :key="bm.id"
                :href="bm.url"
                target="_blank"
                rel="noopener noreferrer"
                class="hero-search-result"
                @click="onResultClick"
              >
                <span class="hero-search-result-favicon">
                  <img v-if="iconSrc(bm)" :src="iconSrc(bm)" :alt="bm.title" loading="lazy" @error="onIconError(bm)" />
                  <span v-else class="favicon-fallback">{{ iconInitial(bm) }}</span>
                </span>
                <span class="hero-search-result-info">
                  <span class="hero-search-result-title">{{ bm.title }}</span>
                  <span class="hero-search-result-url">{{ bm.url }}</span>
                </span>
              </a>

              <div v-if="internalResults.length > 0 && showEngineHint" class="hero-search-engine-hint">
                ↵ 用 {{ currentEngineLabel }} 搜索 "{{ query }}"
              </div>

              <div v-if="internalResults.length === 0 && showEngineHint" class="hero-search-empty">
                无站内匹配，按 ↵ 用 {{ currentEngineLabel }} 搜索 "{{ query }}"
              </div>
            </div>
          </form>

          <!-- 常用站点：排序前 5 -->
          <div v-if="favoriteBookmarks.length" class="hero-favorites">
            <a
              v-for="bm in favoriteBookmarks"
              :key="bm.id"
              class="hero-fav-card"
              :href="bm.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="hero-fav-icon">
                <img v-if="iconSrc(bm)" :src="iconSrc(bm)" :alt="bm.title" loading="lazy" @error="onIconError(bm)" />
                <span v-else class="favicon-fallback">{{ iconInitial(bm) }}</span>
              </span>
              <span class="hero-fav-name">{{ bm.title }}</span>
            </a>
          </div>
        </div>

        <!-- 滚动提示 -->
        <a class="hero-scroll-hint" href="#explorer-section">
          <span>向下滚动查看书签库</span>
          <i class="ri-arrow-down-line"></i>
        </a>
      </section>

      <!-- 第二屏：书签库 -->
      <BookmarkExplorer
        :bookmarks="bookmarks"
        :categories="explorerCategories"
        :active-cat="activeCategory"
        @add-bookmark="showBookmarkForm()"
        @add-category="showCategoryForm()"
        @select-category="selectCategory"
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
          <span class="app-footer-site">{{ settingsStore.displayName }}</span>
          <span>·</span>
          <span>{{ categories.length }} 个分类 · {{ bookmarks.length }} 个书签</span>
        </div>
        <div class="app-footer-links">
          <button type="button" @click="settingsModal.visible = true">导入与导出</button>
          <button type="button" @click="shortcutModal.visible = true">键盘快捷键</button>
          <span class="app-footer-version">v{{ appVersion }}</span>
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

    <!-- 快捷键帮助 -->
    <ShortcutHelp
      v-if="shortcutModal.visible"
      @close="shortcutModal.visible = false"
    />

    <!-- 删除确认弹窗 -->
    <ConfirmModal
      v-if="confirmModal.visible"
      :title="confirmModal.title"
      :message="confirmModal.message"
      :loading="confirmModal.loading"
      @confirm="handleConfirmAction"
      @cancel="confirmModal.visible = false"
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
import BookmarkExplorer from '../components/bookmark/BookmarkExplorer.vue'
import BookmarkForm from '../components/bookmark/BookmarkForm.vue'
import CategoryForm from '../components/category/CategoryForm.vue'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import Modal from '../components/common/Modal.vue'
import SettingsPanel from '../components/common/SettingsPanel.vue'
import ShortcutHelp from '../components/common/ShortcutHelp.vue'
import ToastMessage from '../components/common/ToastMessage.vue'

import { useBookmarks } from '../composables/useBookmarks'
import { useCategories } from '../composables/useCategories'
import { useAuth } from '../composables/useAuth'
import { useContextMenu } from '../composables/useContextMenu'
import { useKeyboard } from '../composables/useKeyboard'
import { useToast } from '../composables/useToast'
import { useSearchEngines } from '../composables/useSearchEngines'
import { useFavicon } from '../composables/useFavicon'
import { useDateInfo } from '../composables/useLunar'
import { useSettingsStore } from '../stores/settings'
import { CATEGORY_ICONS } from '../constants/categoryIcons'
import pkg from '../../package.json'

const settingsStore = useSettingsStore()
const appVersion = pkg.version

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
const { engines, currentEngineId, setEngine, resolveAndOpen } = useSearchEngines()
const { iconSrc, onIconError, iconInitial } = useFavicon()
const { getLunarText, getWeekOfYear, getGregorianText, getWeekdayText } = useDateInfo()

// ── 本地状态 ──
const activeCategory = ref('all')

const categoryModal = ref({ visible: false, data: null, loading: false })
const bookmarkModal = ref({ visible: false, data: null, loading: false })
const settingsModal = ref({ visible: false })
const shortcutModal = ref({ visible: false })
const confirmModal = ref({ visible: false, title: '', message: '', loading: false, onConfirm: null })

// ── 时钟（每秒刷新；农历每分钟异步刷新） ──
const now = ref(new Date())
let clockTimer = null
let lunarTimer = null

const hhmm = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const ss = computed(() => String(now.value.getSeconds()).padStart(2, '0'))
const gregorianText = computed(() => getGregorianText(now.value))
const weekdayText = computed(() => getWeekdayText(now.value))
const weekOfYear = computed(() => getWeekOfYear(now.value))
// 农历依赖较大，动态加载后异步填充
const lunarText = ref('')

async function refreshLunar() {
  lunarText.value = await getLunarText(now.value)
}

// ── 搜索 ──
const searchInput = ref(null)
const query = ref('')
const hasFocus = ref(false)
const engineMenuOpen = ref(false)

const currentEngineLabel = computed(() => engines.find(e => e.id === currentEngineId.value)?.label || '')

// 站内匹配：标题 / URL
const internalResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return bookmarks.value
    .filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q)
    )
    .slice(0, 6)
})

const showDropdown = computed(() => query.value.trim() && hasFocus.value)
const showEngineHint = computed(() => query.value.trim().length > 0)

function onSearchInput() {
  hasFocus.value = true
}

function onSearchFocus() {
  hasFocus.value = true
}

function onSearchBlur() {
  // 延迟关闭，避免点击下拉时先失焦
  setTimeout(() => { hasFocus.value = false }, 150)
}

function toggleEngineMenu() {
  engineMenuOpen.value = !engineMenuOpen.value
}

function selectEngine(id) {
  setEngine(id)
  engineMenuOpen.value = false
  searchInput.value?.focus()
}

function closeEngineMenu() {
  engineMenuOpen.value = false
}

// 点击引擎菜单以外区域时关闭
function onDocumentClick(e) {
  if (engineMenuOpen.value && !e.target.closest('.hero-search-engine-wrap')) {
    closeEngineMenu()
  }
}

function onResultClick() {
  query.value = ''
  hasFocus.value = false
}

function onSearchSubmit() {
  const result = resolveAndOpen(query.value)
  if (!result) return
  // 回车一律按当前规则跳转：域名直达或当前引擎搜索
  window.open(result.target, '_blank', 'noopener,noreferrer')
  query.value = ''
  hasFocus.value = false
}

function focusSearch() {
  searchInput.value?.focus()
  searchInput.value?.select()
}

// ── 常用站点：按 sort_order 取前 5 ──
const favoriteBookmarks = computed(() =>
  [...bookmarks.value]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .slice(0, 5)
)

// ── 分类计数 ──
const categoryCountMap = computed(() => {
  const map = {}
  categories.value.forEach(c => { map[c.id] = 0 })
  bookmarks.value.forEach(b => {
    if (b.category_id && map[b.category_id] !== undefined) map[b.category_id]++
  })
  return map
})

const explorerCategories = computed(() => {
  return categories.value.map(c => ({
    id: c.id,
    name: c.name,
    count: categoryCountMap.value[c.id] || 0
  }))
})

// ── 分类选择（tabs 位于第二屏，无需滚动） ──
function selectCategory(id) {
  activeCategory.value = id
}

// ── 快捷键 ──
useKeyboard({
  search: focusSearch,
  addBookmark: () => showBookmarkForm(),
  addCategory: () => showCategoryForm(),
  close: () => {
    categoryModal.value.visible = false
    bookmarkModal.value.visible = false
    settingsModal.value.visible = false
    shortcutModal.value.visible = false
    closeEngineMenu()
    hideContextMenu()
  }
})

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
      askConfirm(
        { title: '删除书签', message: `确定要删除「${target.title}」吗？` },
        async () => {
          try {
            await deleteBookmark(target.id)
            success('书签已删除')
          } catch (err) {
            showError('删除失败: ' + err.message)
          }
        }
      )
      break
    case 'edit-category': {
      // explorer 传出的对象只含 id/name/count，编辑表单需要完整的分类数据
      const full = categories.value.find(c => c.id === target.id)
      if (full) showCategoryForm(full)
      break
    }
    case 'delete-category':
      askConfirm(
        { title: '删除分类', message: `确定删除分类「${target.name}」吗？分类下的书签将变为未分类。` },
        async () => {
          try {
            await deleteCategory(target.id)
            if (activeCategory.value === target.id) activeCategory.value = 'all'
            success('分类已删除')
          } catch (err) {
            showError('删除失败: ' + err.message)
          }
        }
      )
      break
  }
}

// ── 删除确认弹窗 ──
function askConfirm({ title, message }, onConfirm) {
  confirmModal.value = { visible: true, title, message, loading: false, onConfirm }
}

async function handleConfirmAction() {
  const { onConfirm } = confirmModal.value
  confirmModal.value.loading = true
  try {
    if (onConfirm) await onConfirm()
  } finally {
    confirmModal.value = { visible: false, title: '', message: '', loading: false, onConfirm: null }
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
  refreshLunar()
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  // 农历一天才变一次，每分钟刷新足够
  lunarTimer = setInterval(refreshLunar, 60000)
  document.addEventListener('click', onDocumentClick)
  await Promise.all([fetchBookmarks(), fetchCategories(), settingsStore.fetchSettings()])
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (lunarTimer) clearInterval(lunarTimer)
  document.removeEventListener('click', onDocumentClick)
})
</script>
