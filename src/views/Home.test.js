// @vitest-environment happy-dom
// 表单弹窗 loading 防误关（Task 18 折叠项）：ESC 全局分支与 Modal @close 在 loading 期间忽略关闭
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import Home from './Home.vue'

// ── 重依赖替换：网络/存储/大组件，保持测试聚焦弹窗关闭守卫 ──
vi.mock('../composables/useBookmarks', async () => {
  const { vi: v } = await import('vitest')
  const { ref } = await import('vue')
  const pending = () => new Promise(() => {})
  return {
    useBookmarks: () => ({
      bookmarks: ref([]),
      loading: ref(false),
      error: ref(null),
      fetchBookmarks: v.fn(async () => {}),
      // 永不 resolve：提交后 loading 保持 true，模拟保存中
      createBookmark: v.fn(pending),
      updateBookmark: v.fn(pending),
      togglePin: v.fn(async () => {}),
      deleteBookmark: v.fn(pending),
      // 永不 resolve：导入中 busy 保持 true（设置面板关闭守卫用例）
      importBookmarks: v.fn(pending)
    })
  }
})

vi.mock('../composables/useCategories', async () => {
  const { vi: v } = await import('vitest')
  const { ref } = await import('vue')
  const pending = () => new Promise(() => {})
  return {
    useCategories: () => ({
      categories: ref([]),
      loading: ref(false),
      error: ref(null),
      fetchCategories: v.fn(async () => {}),
      createCategory: v.fn(pending),
      updateCategory: v.fn(pending),
      deleteCategory: v.fn(pending),
      reorderCategories: v.fn(async () => {})
    })
  }
})

vi.mock('../composables/useAuth', async () => {
  const { ref } = await import('vue')
  return { useAuth: () => ({ username: ref('管理员') }) }
})

vi.mock('../stores/settings', () => ({
  useSettingsStore: () => ({
    displayName: 'NavBase',
    siteName: '',
    avatar: '',
    fetchSettings: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => {})
  })
}))

vi.mock('../stores/bookmarks', () => ({
  useBookmarksStore: () => ({ reorderBookmarks: vi.fn(async () => true) })
}))

// AppHeader 依赖 RouterLink（需 router 实例）、BookmarkExplorer 依赖 sortablejs：均与守卫无关，渲染桩替代
vi.mock('../components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeaderStub', render: () => null }
}))
vi.mock('../components/bookmark/BookmarkExplorer.vue', () => ({
  default: { name: 'BookmarkExplorerStub', render: () => null }
}))

// 设置面板依赖 router 与书签 HTML 解析：与关闭守卫无关，解析桩返回一个可建的分类
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: () => {} })
}))
vi.mock('../utils/importBookmarks', () => ({
  parseNetscapeBookmarks: () => ({ categories: [{ name: '待建分类', links: [] }], roots: [] })
}))

const apps = []

async function mountHome() {
  const app = createApp(Home)
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  apps.push(app)
  await nextTick()
  await nextTick()
  return el
}

function press(code, opts = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code, ...opts }))
}

function setInput(input, value) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function openBookmarkModal() {
  press('KeyN', { altKey: true })
  await nextTick()
  expect(document.querySelector('.modal')).not.toBeNull()
}

async function openCategoryModal() {
  press('KeyN', { altKey: true, shiftKey: true })
  await nextTick()
  expect(document.querySelector('.modal')).not.toBeNull()
}

async function openSettings() {
  const btn = [...document.querySelectorAll('.app-footer button')]
    .find((b) => b.textContent.includes('导入与导出'))
  btn.click()
  await nextTick()
  expect(document.querySelector('.modal')).not.toBeNull()
}

// 触发设置面板的隐藏文件导入：createCategory/importBookmarks 永挂起 → busy 保持 true
function triggerSettingsImport() {
  const input = document.querySelector('input[accept=".html,text/html"]')
  const file = new File(['<DL></DL>'], 'bookmarks.html', { type: 'text/html' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// 填表并提交：createBookmark/createCategory 永挂起 → loading 保持 true
async function submitBookmarkForm() {
  const modal = document.querySelector('.modal')
  setInput(modal.querySelector('input[type="url"]'), 'https://example.com')
  setInput(modal.querySelector('input[type="text"]'), '示例站点')
  await nextTick()
  modal.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  // 确认已进入 loading（按钮显示保存中）
  expect(modal.querySelector('button[type="submit"]').textContent).toContain('保存中')
}

async function submitCategoryForm() {
  const modal = document.querySelector('.modal')
  setInput(modal.querySelector('input[type="text"]'), '测试分类')
  await nextTick()
  modal.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  expect(modal.querySelector('button[type="submit"]').textContent).toContain('保存中')
}

afterEach(() => {
  apps.forEach(app => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
})

describe('Home 表单弹窗 loading 关闭守卫', () => {
  it('书签表单 loading 中按 ESC 弹窗不关', async () => {
    await mountHome()
    await openBookmarkModal()
    await submitBookmarkForm()

    press('Escape', { key: 'Escape' })
    await nextTick()
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('书签表单 loading 中点关闭按钮弹窗不关', async () => {
    await mountHome()
    await openBookmarkModal()
    await submitBookmarkForm()

    document.querySelector('.modal-close').click()
    await nextTick()
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('分类表单 loading 中按 ESC 弹窗不关', async () => {
    await mountHome()
    await openCategoryModal()
    await submitCategoryForm()

    press('Escape', { key: 'Escape' })
    await nextTick()
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('分类表单 loading 中点关闭按钮弹窗不关', async () => {
    await mountHome()
    await openCategoryModal()
    await submitCategoryForm()

    document.querySelector('.modal-close').click()
    await nextTick()
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('回归：未 loading 时 ESC 正常关闭弹窗', async () => {
    await mountHome()
    await openBookmarkModal()

    press('Escape', { key: 'Escape' })
    await nextTick()
    expect(document.querySelector('.modal')).toBeNull()
  })
})

describe('Home 设置面板导入中关闭守卫', () => {
  it('导入中按 ESC 面板不关', async () => {
    await mountHome()
    await openSettings()
    triggerSettingsImport()
    await nextTick()
    await nextTick()

    press('Escape', { key: 'Escape' })
    await nextTick()
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('导入中点关闭按钮面板不关', async () => {
    await mountHome()
    await openSettings()
    triggerSettingsImport()
    await nextTick()
    await nextTick()

    document.querySelector('.modal-close').click()
    await nextTick()
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('回归：空闲时 ESC 正常关闭设置面板', async () => {
    await mountHome()
    await openSettings()

    press('Escape', { key: 'Escape' })
    await nextTick()
    expect(document.querySelector('.modal')).toBeNull()
  })
})
