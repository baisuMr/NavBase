// @vitest-environment happy-dom
// 设置面板导入流程：分类创建中途失败必须同步分类 store（防重试产生重复分类）；
// 导入进行中上报 busy（供 Home 关闭守卫使用）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import SettingsPanel from './SettingsPanel.vue'

const hoisted = vi.hoisted(() => ({
  parse: vi.fn(),
  createCategory: vi.fn(),
  fetchCategories: vi.fn(async () => {}),
  importBookmarks: vi.fn(async () => ({ count: 0, skipped: 0 })),
  fetchBookmarks: vi.fn(async () => {}),
  updateSettings: vi.fn(async () => {}),
  logout: vi.fn(),
  close: vi.fn(),
  busy: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('../../utils/importBookmarks', () => ({
  parseNetscapeBookmarks: (...args) => hoisted.parse(...args)
}))

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => ({
    siteName: '',
    avatar: '',
    updateSettings: hoisted.updateSettings
  })
}))

vi.mock('../../composables/useBookmarks', () => ({
  useBookmarks: () => ({
    bookmarks: { value: [] },
    importBookmarks: hoisted.importBookmarks,
    fetchBookmarks: hoisted.fetchBookmarks
  })
}))

vi.mock('../../composables/useCategories', () => ({
  useCategories: () => ({
    categories: { value: [] },
    createCategory: hoisted.createCategory,
    fetchCategories: hoisted.fetchCategories
  })
}))

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({ username: { value: '管理员' }, logout: hoisted.logout })
}))

const apps = []
function mountPanel() {
  const app = createApp({
    setup() {
      return () => h(SettingsPanel, { onClose: hoisted.close, onBusy: hoisted.busy })
    }
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  apps.push(app)
  return el
}

// 用假书签文件触发隐藏的文件导入 input
function triggerImport(el) {
  const input = el.querySelector('input[accept=".html,text/html"]')
  const file = new File(['<DL></DL>'], 'bookmarks.html', { type: 'text/html' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// 刷新微任务与渲染，等待导入流程各 await 推进
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  apps.forEach((app) => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
})

describe('SettingsPanel 导入流程', () => {
  it('分类创建中途失败后同步分类 store（fetchCategories），避免重试产生重复分类', async () => {
    hoisted.parse.mockReturnValue({
      categories: [
        { name: '分类A', links: [] },
        { name: '分类B', links: [] }
      ],
      roots: []
    })
    // 第二个分类创建失败（如名称超 50 字被服务端拒绝）
    hoisted.createCategory.mockImplementation(async ({ name }) => {
      if (name === '分类B') throw new Error('分类名称不能超过 50 个字')
      return 1
    })

    const el = mountPanel()
    triggerImport(el)
    await flush()

    // 前一个分类已入库：错误路径必须重拉分类，重试同文件时才能复用而非重建
    expect(hoisted.createCategory).toHaveBeenCalledTimes(2)
    expect(hoisted.fetchCategories).toHaveBeenCalled()
  })

  it('导入进行中上报 busy=true，完成后回到 busy=false', async () => {
    hoisted.parse.mockReturnValue({
      categories: [{ name: '分类A', links: [{ title: 'A 站', url: 'https://a.com/' }] }],
      roots: []
    })
    hoisted.createCategory.mockResolvedValue(1)
    let resolveImport
    hoisted.importBookmarks.mockImplementation(
      () => new Promise((resolve) => { resolveImport = resolve })
    )

    const el = mountPanel()
    triggerImport(el)
    await flush()

    // 批量导入尚未完成：busy 保持 true
    expect(hoisted.busy).toHaveBeenCalledWith(true)

    resolveImport({ count: 1, skipped: 0 })
    await flush()

    // 导入结束 busy 回落，允许关闭面板
    expect(hoisted.busy.mock.calls.at(-1)[0]).toBe(false)
  })

  it('导入失败后 busy 回落为 false', async () => {
    hoisted.parse.mockReturnValue({
      categories: [{ name: '分类A', links: [] }],
      roots: []
    })
    hoisted.createCategory.mockRejectedValue(new Error('网络错误'))

    const el = mountPanel()
    triggerImport(el)
    await flush()

    expect(hoisted.busy.mock.calls.at(-1)[0]).toBe(false)
    expect(hoisted.close).not.toHaveBeenCalled()
  })
})

describe('SettingsPanel 清除图标缓存', () => {
  it('点击按钮写入新的 favicon_cache_ver 世代号', async () => {
    const el = mountPanel()
    const btn = [...el.querySelectorAll('button')]
      .find((b) => b.textContent.includes('清除图标缓存'))
    expect(btn).toBeTruthy()
    btn.click()
    await flush()

    expect(hoisted.updateSettings).toHaveBeenCalledTimes(1)
    const payload = hoisted.updateSettings.mock.calls[0][0]
    expect(Number.isInteger(payload.favicon_cache_ver)).toBe(true)
    expect(payload.favicon_cache_ver).toBeGreaterThan(0)
  })
})
