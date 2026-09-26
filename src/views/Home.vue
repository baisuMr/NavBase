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
          <!-- 时钟 + 日期行（独立组件：秒级 tick 只重渲染该子树） -->
          <HeroClock />

          <!-- 搜索 -->
          <form class="hero-search" @submit.prevent="submitSearch">
            <div class="hero-search-box">
              <div class="hero-search-engine-wrap">
                <button
                  type="button"
                  class="hero-search-engine"
                  :aria-expanded="engineMenuOpen"
                  @click="toggleEngineMenu"
                >
                  <i class="hero-search-engine-logo" :class="currentEngine.icon"></i>
                  <span>{{ currentEngine.label }}</span>
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
                    <i class="hero-search-engine-logo" :class="engine.icon"></i>
                    <span>{{ engine.label }}</span>
                  </button>
                </div>
              </div>

              <div class="hero-search-field">
                <input
                  ref="searchInput"
                  v-model="query"
                  type="text"
                  class="hero-search-input"
                  placeholder="输入关键词或网页链接， Enter 立即检索，Tab 切换搜索引擎"
                  autocomplete="off"
                  @input="onSearchInput"
                  @focus="onSearchFocus"
                  @blur="onSearchBlur"
                  @keydown="onSearchKeydown"
                />
              </div>

              <div class="hero-search-kbd">
                <span class="kbd">Alt</span>
                <span class="kbd">K</span>
              </div>
            </div>

            <!-- 站内结果下拉（无站内匹配时仅显示搜索项） -->
            <div
              v-if="showDropdown"
              class="hero-search-results"
              @mousedown.prevent
            >
              <a
                v-for="(bm, i) in internalResults"
                :key="bm.id"
                :href="bm.url"
                target="_blank"
                rel="noopener noreferrer"
                class="hero-search-result"
                :class="{ highlighted: i === highlightedIndex }"
                @click="onResultClick"
                @mouseenter="highlightedIndex = i"
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

              <!-- 搜索项：下拉最后一个可选项（无站内匹配时唯一选项），↑/↓ 可选、回车或点击执行搜索 -->
              <div
                class="hero-search-engine-hint"
                :class="{ highlighted: highlightedIndex === internalResults.length }"
                @click="submitSearch"
                @mouseenter="highlightedIndex = internalResults.length"
              >
                <template v-if="internalResults.length > 0">↵ 用 {{ currentEngine.label }} 搜索 "{{ query }}"</template>
                <template v-else>无站内匹配，↵ 用 {{ currentEngine.label }} 搜索 "{{ query }}"</template>
              </div>
            </div>
          </form>

          <!-- 常用站点：手动固定的书签（上限 10） -->
          <div v-if="favoriteBookmarks.length" class="hero-favorites">
            <a
              v-for="bm in favoriteBookmarks"
              :key="bm.id"
              class="hero-fav-card"
              :href="bm.url"
              target="_blank"
              rel="noopener noreferrer"
              @contextmenu.prevent="showBookmarkMenu($event, bm)"
            >
              <span class="hero-fav-icon">
                <img v-if="iconSrc(bm)" :src="iconSrc(bm)" :alt="bm.title" loading="lazy" @error="onIconError(bm)" />
                <span v-else class="favicon-fallback">{{ iconInitial(bm) }}</span>
              </span>
              <span class="hero-fav-name">{{ bm.title }}</span>
            </a>
          </div>

          <!-- 空状态：一个都没固定时提示操作入口（库里没有书签时不提示） -->
          <div v-else-if="bookmarks.length" class="hero-favorites-empty">
            <i class="ri-pushpin-line"></i>
            <span>右键书签卡片，可固定到首屏</span>
          </div>
        </div>

        <!-- 滚动提示 -->
        <a class="hero-scroll-hint" href="#explorer-section">
          <span>向下滚动查看书签库</span>
          <i class="ri-arrow-down-line"></i>
        </a>
      </section>

      <!-- 数据加载失败横幅：可见的失败态 + 重试入口（成功/加载中不显示） -->
      <div v-if="loadError" class="load-error" role="alert">
        <span>数据加载失败：{{ loadError }}</span>
        <button type="button" class="btn btn-secondary btn-sm" @click="reload">重试</button>
      </div>

      <!-- 第二屏：书签库 -->
      <BookmarkExplorer
        :bookmarks="bookmarks"
        :categories="explorerCategories"
        :active-cat="activeCategory"
        :loading="bookmarksLoading"
        :error="!!bookmarksError"
        @add-bookmark="showBookmarkForm()"
        @add-category="showCategoryForm()"
        @select-category="selectCategory"
        @category-menu="showCategoryMenu"
        @menu="showBookmarkMenu"
        @reorder="onCategoryReorder"
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
          <a href="https://github.com/baisuMr/NavBase" target="_blank" rel="noopener noreferrer">GitHub</a>
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
      @close="closeCategoryModal"
    >
      <CategoryForm
        :category="categoryModal.data"
        :colors="presetColors"
        :icons="CATEGORY_ICONS"
        :loading="categoryModal.loading"
        @submit="handleCategorySubmit"
        @cancel="closeCategoryModal"
      />
    </Modal>

    <!-- 书签表单弹窗 -->
    <Modal
      v-if="bookmarkModal.visible"
      :title="bookmarkModal.data ? '编辑书签' : '新建书签'"
      @close="closeBookmarkModal"
    >
      <BookmarkForm
        :bookmark="bookmarkModal.data"
        :categories="categories"
        :loading="bookmarkModal.loading"
        @submit="handleBookmarkSubmit"
        @cancel="closeBookmarkModal"
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
      :seq="toast.seq"
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
import HeroClock from '../components/common/HeroClock.vue'
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
import { useSettingsStore } from '../stores/settings'
import { CATEGORY_ICONS } from '../constants/categoryIcons'
import { selectPinnedBookmarks } from '../utils/pinned'
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

const { bookmarks, loading: bookmarksLoading, error: bookmarksError, fetchBookmarks, createBookmark, updateBookmark, togglePin, deleteBookmark } = useBookmarks()
const { categories, error: categoriesError, fetchCategories, createCategory, updateCategory, deleteCategory, reorderCategories } = useCategories()
const { username } = useAuth()
const { contextMenu, showContextMenu, hideContextMenu, handleMenuSelect } = useContextMenu()
const { toast, hideToast, success, error: showError } = useToast()
const { engines, currentEngineId, currentEngine, setEngine, resolveAndOpen } = useSearchEngines()
const { iconSrc, onIconError, iconInitial } = useFavicon()

// ── 本地状态 ──
const activeCategory = ref('all')

const categoryModal = ref({ visible: false, data: null, loading: false })
const bookmarkModal = ref({ visible: false, data: null, loading: false })
const settingsModal = ref({ visible: false })
const shortcutModal = ref({ visible: false })
const confirmModal = ref({ visible: false, title: '', message: '', loading: false, onConfirm: null })

// ── 搜索 ──
const searchInput = ref(null)
const query = ref('')
const hasFocus = ref(false)
const engineMenuOpen = ref(false)
// 下拉高亮索引：-1 表示未激活（仅按过 ↑/↓ 后才高亮，回车跳转选中项）
const highlightedIndex = ref(-1)

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

function onSearchInput() {
  hasFocus.value = true
  // 输入变化后结果集更新，旧高亮索引失效
  highlightedIndex.value = -1
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

/** 执行搜索跳转：域名直达或当前引擎搜索；空输入跳转引擎主页 */
function submitSearch() {
  const result = resolveAndOpen(query.value)
  if (!result) {
    // 空输入回车：跳转当前搜索引擎主页
    window.open(currentEngine.value.home, '_blank', 'noopener,noreferrer')
    hasFocus.value = false
    return
  }
  window.open(result.target, '_blank', 'noopener,noreferrer')
  query.value = ''
  hasFocus.value = false
}

/**
 * 搜索框键盘操作：
 *  - Tab（不带 Shift）循环切换搜索引擎，Shift+Tab 保留浏览器原生焦点后退
 *  - ↑/↓ 在下拉可见时循环移动高亮，循环范围包含末尾的「用引擎搜索」项
 *  - 回车：有高亮时跳转选中项（书签或搜索项）；无高亮走表单 submit 正常搜索
 *  - Esc 且已有高亮：仅清除高亮（全局 Esc 关弹层逻辑不受影响）
 *  - IME 组合态（中文输入法选词）一律不处理
 */
function onSearchKeydown(e) {
  if (e.isComposing) return

  // Tab 切换引擎
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    const idx = engines.findIndex(en => en.id === currentEngineId.value)
    const next = engines[(idx + 1) % engines.length]
    setEngine(next.id)
    return
  }

  const dropdownActive = showDropdown.value

  // ↑/↓ 移动高亮（循环；范围 = 站内结果 + 末尾搜索项）
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && dropdownActive) {
    e.preventDefault()
    const n = internalResults.value.length + 1
    if (e.key === 'ArrowDown') {
      highlightedIndex.value = highlightedIndex.value < 0 ? 0 : (highlightedIndex.value + 1) % n
    } else {
      highlightedIndex.value = highlightedIndex.value < 0 ? n - 1 : (highlightedIndex.value - 1 + n) % n
    }
    return
  }

  // 回车且有高亮：跳转选中项（书签或搜索项）
  if (e.key === 'Enter' && dropdownActive && highlightedIndex.value >= 0) {
    e.preventDefault()
    if (highlightedIndex.value < internalResults.value.length) {
      // 站内书签
      const bm = internalResults.value[highlightedIndex.value]
      window.open(bm.url, '_blank', 'noopener,noreferrer')
      query.value = ''
      hasFocus.value = false
      highlightedIndex.value = -1
    } else {
      // 末尾搜索项：等价于回车搜索
      submitSearch()
      highlightedIndex.value = -1
    }
    return
  }

  // Esc 且有高亮：仅清除高亮
  if (e.key === 'Escape' && highlightedIndex.value >= 0) {
    highlightedIndex.value = -1
  }
}

function focusSearch() {
  searchInput.value?.focus()
  searchInput.value?.select()
}

// ── 常用站点：手动固定的书签（上限 10，宽屏一行 5 个最多两行） ──
const favoriteBookmarks = computed(() => selectPinnedBookmarks(bookmarks.value))

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
    count: categoryCountMap.value[c.id] || 0,
    icon: c.icon,
    color: c.color
  }))
})

// ── 加载失败横幅：书签或分类任一拉取失败即显示（重试两个都重拉） ──
const loadError = computed(() => bookmarksError.value || categoriesError.value)

function reload() {
  fetchBookmarks()
  fetchCategories()
}

// ── 分类选择（tabs 位于第二屏，无需滚动） ──
function selectCategory(id) {
  activeCategory.value = id
}

// ── 分类拖动排序 ──
async function onCategoryReorder(ids) {
  const ok = await reorderCategories(ids)
  if (!ok) showError('排序保存失败，已恢复原顺序')
}

// ── 快捷键 ──
useKeyboard({
  search: focusSearch,
  addBookmark: () => showBookmarkForm(),
  addCategory: () => showCategoryForm(),
  close: () => {
    // 表单弹窗 loading 中不响应 ESC（焦点在弹窗外时由这里兜底，与 @close 守卫对齐）
    closeCategoryModal()
    closeBookmarkModal()
    settingsModal.value.visible = false
    shortcutModal.value.visible = false
    // 确认弹窗 loading 中不响应 ESC（焦点在弹窗外时由这里兜底）
    if (!confirmModal.value.visible || !confirmModal.value.loading) {
      confirmModal.value.visible = false
    }
    closeEngineMenu()
    hideContextMenu()
  }
})

// ── 右键菜单 ──
function showBookmarkMenu(event, bookmark) {
  showContextMenu(event, [
    { icon: 'ri-edit-line', label: '编辑', action: 'edit-bookmark' },
    { icon: 'ri-file-copy-line', label: '复制链接', action: 'copy-link' },
    {
      icon: bookmark.is_pinned ? 'ri-unpin-line' : 'ri-pushpin-line',
      label: bookmark.is_pinned ? '取消固定' : '固定到首屏',
      action: 'toggle-pin'
    },
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
    case 'toggle-pin':
      try {
        await togglePin(target)
        success(target.is_pinned ? '已取消固定' : '已固定到首屏')
      } catch (err) {
        showError('操作失败: ' + err.message)
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

// 表单弹窗 loading 中忽略关闭（遮罩/ESC/取消按钮均汇入此处，对齐 ConfirmModal 守卫语义），
// 避免弹窗关掉但后台保存仍在跑
function closeCategoryModal() {
  if (!categoryModal.value.loading) categoryModal.value.visible = false
}
function closeBookmarkModal() {
  if (!bookmarkModal.value.loading) bookmarkModal.value.visible = false
}

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
  document.addEventListener('click', onDocumentClick)
  await Promise.all([fetchBookmarks(), fetchCategories(), settingsStore.fetchSettings()])
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>
