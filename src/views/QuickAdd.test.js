// @vitest-environment happy-dom
// 快捷添加弹窗：窗口高度随内容自适应（resizeTo，避免滚动条）；保存成功停留片刻后自动关闭
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import QuickAdd from './QuickAdd.vue'

// 初次数据加载可控：挂起直到测试放行，模拟「数据就绪前隐藏、就绪后一次性调整再显示」
const hoisted = vi.hoisted(() => ({ resolveSettings: null, resolveCategories: null }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { url: 'https://example.com', title: '示例站点', desc: '' } })
}))

vi.mock('../composables/useBookmarks', async () => {
  const { vi: v } = await import('vitest')
  return {
    useBookmarks: () => ({
      createBookmark: v.fn(async () => {})
    })
  }
})

vi.mock('../composables/useCategories', async () => {
  const { ref } = await import('vue')
  return {
    useCategories: () => ({
      categories: ref([]),
      fetchCategories: () => new Promise((resolve) => { hoisted.resolveCategories = resolve })
    })
  }
})

vi.mock('../stores/settings', () => ({
  useSettingsStore: () => ({
    displayName: 'NavBase',
    fetchSettings: () => new Promise((resolve) => { hoisted.resolveSettings = resolve })
  })
}))

// 放行初次数据加载
function releaseData() {
  hoisted.resolveSettings()
  hoisted.resolveCategories()
}

// 模拟真实 resizeBy：窗口视口高随之变化并触发 resize 事件（异步立即生效的理想情形）
// 一律走 stubGlobal，afterEach 的 unstubAllGlobals 统一还原，避免跨用例污染 window
function spyOnResizeBy() {
  const resizeBy = vi.fn((dw, dh) => {
    vi.stubGlobal('innerHeight', window.innerHeight + dh)
    window.dispatchEvent(new Event('resize'))
  })
  vi.stubGlobal('resizeBy', resizeBy)
  return resizeBy
}

// 模拟异步未生效的 resizeBy：只记录调用，innerHeight/resize 事件不变（真实浏览器生效有延迟）
function spyOnPendingResizeBy() {
  const resizeBy = vi.fn()
  vi.stubGlobal('resizeBy', resizeBy)
  return resizeBy
}

// RO 可手动触发，模拟内容高度变化
class FakeResizeObserver {
  static instances = []
  constructor(callback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }
  observe() {}
  disconnect() {}
  trigger() { this.callback([], this) }
}

const apps = []

async function mountQuickAdd() {
  const app = createApp(QuickAdd)
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  apps.push(app)
  await nextTick()
  return el
}

// 刷新微任务与渲染（fake timers 下不能靠 setTimeout flush）
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await nextTick()
}

function submitForm(el) {
  el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  apps.forEach((app) => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('QuickAdd 弹窗高度自适应', () => {
  // 先测量就位再显示内容：数据就绪前隐藏（visibility 不占视觉、仍占布局可测量），
  // 就绪后按卡片内容高一次性 resizeBy 差值（resizeTo 绝对尺寸的 outer/inner 语义
  // 各浏览器不一，易多算窗口边框；scrollHeight 又被 min-height:100vh 顶在视口高）
  it('数据就绪前内容隐藏且不调整窗口', async () => {
    const resizeBy = spyOnResizeBy()
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()

    expect(document.querySelector('.quick-add-page').classList.contains('quick-add-hidden')).toBe(true)
    expect(resizeBy).not.toHaveBeenCalled()
  })

  it('数据就绪后一次性调整窗口再显示，高度含 page 下内边距', async () => {
    const resizeBy = spyOnResizeBy()
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()
    // 卡片：上偏移 16（page 上内边距）+ 高 518 + 下内边距 16 = 内容 550
    document.querySelector('.quick-add-page').style.paddingBottom = '16px'
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush()

    expect(resizeBy).toHaveBeenCalledTimes(1)
    expect(resizeBy).toHaveBeenCalledWith(0, 550 - 460)
    expect(document.querySelector('.quick-add-page').classList.contains('quick-add-hidden')).toBe(false)
  })

  it('内容变矮（成功页）时窗口跟随收缩，下方不留白', async () => {
    const resizeBy = spyOnResizeBy()
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush()

    // 模拟切换到成功页后内容变矮（16 + 218 = 234），视口已随首次调整变 534
    Object.defineProperty(card, 'offsetHeight', { value: 218, configurable: true })
    FakeResizeObserver.instances.at(-1).trigger()
    await flush()

    expect(resizeBy).toHaveBeenCalledWith(0, 234 - 534)
  })

  it('内容高度未变时不重复调整窗口', async () => {
    const resizeBy = spyOnResizeBy()
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush()

    // 高度未变触发观察器（如 resizeBy 自身引起的回流）
    FakeResizeObserver.instances.at(-1).trigger()
    await flush()

    expect(resizeBy).toHaveBeenCalledTimes(1)
  })

  it('resizeBy 异步生效前的观察器回调不叠加调整', async () => {
    const resizeBy = spyOnPendingResizeBy()
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush()

    // 模拟 resize 生效（真实浏览器此时 innerHeight 已更新），显示并挂上观察器
    window.dispatchEvent(new Event('resize'))
    await flush()

    // 生效前观察器回调读到旧 innerHeight，仍不能重复加同样的增量
    FakeResizeObserver.instances.at(-1).trigger()
    await flush()

    expect(resizeBy).toHaveBeenCalledTimes(1)
    expect(resizeBy).toHaveBeenCalledWith(0, 534 - 460)
  })

  it('窗口调整被浏览器忽略时超时兜底显示，不卡隐藏', async () => {
    vi.useFakeTimers()
    spyOnPendingResizeBy()
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush()

    // 独立标签页场景 resizeBy 被忽略、resize 事件不来
    expect(document.querySelector('.quick-add-page').classList.contains('quick-add-hidden')).toBe(true)
    vi.advanceTimersByTime(150)
    await flush()

    expect(document.querySelector('.quick-add-page').classList.contains('quick-add-hidden')).toBe(false)
  })

  it('resizeBy 被部分钳制后按实际视口重试调整', async () => {
    // 模拟钳制：只应用一半增量，窗口停在中间高度
    const resizeBy = vi.fn((dw, dh) => {
      vi.stubGlobal('innerHeight', window.innerHeight + Math.trunc(dh / 2))
      window.dispatchEvent(new Event('resize'))
    })
    vi.stubGlobal('resizeBy', resizeBy)
    vi.stubGlobal('innerHeight', 460)

    await mountQuickAdd()
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush()

    // 首次请求 (0, 74) 只应用一半，视口停在 497
    expect(resizeBy).toHaveBeenCalledWith(0, 534 - 460)
    FakeResizeObserver.instances.at(-1).trigger()
    await flush()

    // 基数必须是实际视口 497，而非已请求目标——重试补差 37
    expect(resizeBy).toHaveBeenCalledWith(0, 534 - 497)
  })

  it('数据未就绪时卸载不改写标题、不抛错', async () => {
    spyOnPendingResizeBy()
    vi.stubGlobal('innerHeight', 460)
    document.title = '原页面'

    await mountQuickAdd()
    apps.pop().unmount()
    releaseData()
    await flush()

    expect(document.title).toBe('原页面')
  })

  it('卸载时清理等待中的 resize 监听与定时器', async () => {
    spyOnPendingResizeBy()
    vi.stubGlobal('innerHeight', 460)
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    await mountQuickAdd()
    const card = document.querySelector('.quick-add-card')
    Object.defineProperty(card, 'offsetTop', { value: 16, configurable: true })
    Object.defineProperty(card, 'offsetHeight', { value: 518, configurable: true })
    releaseData()
    await flush() // 挂在「等调整生效」上

    apps.pop().unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})

describe('QuickAdd 保存后自动关闭', () => {
  it('保存成功先显示成功页，约 1 秒后自动关闭窗口', async () => {
    vi.useFakeTimers()
    const close = vi.fn()
    vi.stubGlobal('close', close)
    vi.stubGlobal('resizeBy', vi.fn())

    const el = await mountQuickAdd()
    submitForm(el)
    await flush()

    // 成功页已显示，但窗口未立即关闭
    expect(el.textContent).toContain('书签已添加')
    expect(close).not.toHaveBeenCalled()

    vi.advanceTimersByTime(999)
    expect(close).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
