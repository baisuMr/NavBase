// @vitest-environment happy-dom
// 分类平铺按钮（替代下拉选择）：渲染未分类+各分类按钮、点击选中、提交携带 category_id
// 自动获取：URL 失焦抓取标题/描述，获取中禁用输入，只填空字段，失败提示手动填写
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'

// 拦截网页元数据 API：自动获取流程由用例按需控制成功/失败
const { getMeta } = vi.hoisted(() => ({ getMeta: vi.fn() }))
vi.mock('../../api/pageMeta', () => ({ pageMetaApi: { get: getMeta } }))

import BookmarkForm from './BookmarkForm.vue'

const CATEGORIES = [
  { id: 1, name: '开发', icon: 'ri-code-line', color: '#2563EB' },
  { id: 2, name: '学习', icon: 'ri-book-line', color: '#10b981' }
]

const apps = []

async function mountForm(props = {}) {
  const submitted = ref(null)
  const app = createApp({
    render: () => h(BookmarkForm, {
      categories: CATEGORIES,
      ...props,
      onSubmit: (payload) => { submitted.value = payload }
    })
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  apps.push(app)
  await nextTick()
  return { el, submitted }
}

function optionBtn(el, name) {
  return [...el.querySelectorAll('.category-option')].find((b) => b.textContent.includes(name))
}

function fillRequired(el) {
  const url = el.querySelector('input[type="url"]')
  url.value = 'https://example.com'
  url.dispatchEvent(new Event('input', { bubbles: true }))
  const title = el.querySelector('input[type="text"]')
  title.value = '示例站点'
  title.dispatchEvent(new Event('input', { bubbles: true }))
}

async function submitForm(el) {
  el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
}

function setUrl(el, value) {
  const url = el.querySelector('input[type="url"]')
  url.value = value
  url.dispatchEvent(new Event('input', { bubbles: true }))
}

function blurUrl(el) {
  el.querySelector('input[type="url"]').dispatchEvent(new Event('blur'))
}

function titleInput(el) {
  return el.querySelector('input[type="text"]')
}

function descInput(el) {
  return el.querySelector('textarea')
}

// 等待微任务链与重渲染完成（异步获取回填后断言用）
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

beforeEach(() => {
  getMeta.mockReset()
})

afterEach(() => {
  apps.forEach((app) => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
})

describe('BookmarkForm 分类平铺按钮', () => {
  it('渲染未分类与各分类按钮，不再有下拉框', async () => {
    const { el } = await mountForm()

    expect(el.querySelector('select')).toBeNull()
    const buttons = el.querySelectorAll('.category-option')
    expect(buttons).toHaveLength(3)
    expect(optionBtn(el, '未分类')).toBeTruthy()
    expect(optionBtn(el, '开发').textContent).toContain('开发')
    expect(optionBtn(el, '学习').textContent).toContain('学习')
    // 紧凑纯文字按钮：不渲染分类图标
    expect(el.querySelector('.category-option i')).toBeNull()
  })

  it('点击分类按钮选中该分类，提交携带其 id', async () => {
    const { el, submitted } = await mountForm()

    optionBtn(el, '开发').click()
    await nextTick()
    expect(optionBtn(el, '开发').getAttribute('aria-pressed')).toBe('true')

    fillRequired(el)
    await submitForm(el)
    expect(submitted.value.category_id).toBe(1)
  })

  it('默认选中未分类，提交 category_id 为 null', async () => {
    const { el, submitted } = await mountForm()

    expect(optionBtn(el, '未分类').getAttribute('aria-pressed')).toBe('true')

    fillRequired(el)
    await submitForm(el)
    expect(submitted.value.category_id).toBeNull()
  })

  it('点未分类可清空已选分类', async () => {
    const { el, submitted } = await mountForm()

    optionBtn(el, '开发').click()
    await nextTick()
    optionBtn(el, '未分类').click()
    await nextTick()

    fillRequired(el)
    await submitForm(el)
    expect(submitted.value.category_id).toBeNull()
  })

  it('编辑时回填当前分类的选中态', async () => {
    const { el } = await mountForm({
      bookmark: { url: 'https://example.com', title: '示例站点', description: '', category_id: 2 }
    })

    expect(optionBtn(el, '学习').getAttribute('aria-pressed')).toBe('true')
    expect(optionBtn(el, '未分类').getAttribute('aria-pressed')).toBe('false')
  })

  it('分类色经 CSS 变量下发，不在内联写死背景/边框', async () => {
    const { el } = await mountForm()
    const btn = optionBtn(el, '开发')

    expect(btn.style.getPropertyValue('--cat-color')).toBe('#2563EB')
    expect(btn.style.backgroundColor).toBe('')
    expect(btn.style.borderColor).toBe('')
  })

  it('长分类名带 title 提示，超长省略也能看全称', async () => {
    const longName = '超长分类名'.repeat(8)
    const { el } = await mountForm({
      categories: [{ id: 9, name: longName, icon: 'ri-book-line', color: '#10b981' }]
    })

    expect(optionBtn(el, longName).getAttribute('title')).toBe(longName)
  })
})

describe('BookmarkForm 自动获取标题与描述', () => {
  it('URL 失焦后禁用名称/描述并提示获取中，成功后填入并解禁', async () => {
    let resolveMeta
    getMeta.mockImplementation(() => new Promise((resolve) => { resolveMeta = resolve }))
    const { el } = await mountForm()

    setUrl(el, 'https://example.com')
    blurUrl(el)
    await nextTick()

    expect(titleInput(el).disabled).toBe(true)
    expect(descInput(el).disabled).toBe(true)
    expect(el.textContent).toContain('正在获取网站信息…')

    resolveMeta({ title: '示例站点', description: '一句描述' })
    await flush()

    expect(titleInput(el).value).toBe('示例站点')
    expect(descInput(el).value).toBe('一句描述')
    expect(titleInput(el).disabled).toBe(false)
    expect(descInput(el).disabled).toBe(false)
    expect(el.textContent).not.toContain('正在获取网站信息…')
  })

  it('名称已有内容不覆盖，只填空描述', async () => {
    getMeta.mockResolvedValue({ title: '抓取标题', description: '抓取描述' })
    const { el } = await mountForm()

    setUrl(el, 'https://example.com')
    const title = titleInput(el)
    title.value = '我的标题'
    title.dispatchEvent(new Event('input', { bubbles: true }))
    blurUrl(el)
    await flush()

    expect(titleInput(el).value).toBe('我的标题')
    expect(descInput(el).value).toBe('抓取描述')
  })

  it('抓取失败提示手动填写并解禁', async () => {
    getMeta.mockRejectedValue(new Error('网络错误'))
    const { el } = await mountForm()

    setUrl(el, 'https://example.com')
    blurUrl(el)
    await flush()

    expect(el.textContent).toContain('自动获取失败，请手动填写')
    expect(titleInput(el).disabled).toBe(false)
    expect(descInput(el).disabled).toBe(false)
  })

  it('成功但标题为空时提示手动填写，描述照常填入', async () => {
    getMeta.mockResolvedValue({ title: '', description: '只有描述' })
    const { el } = await mountForm()

    setUrl(el, 'https://example.com')
    blurUrl(el)
    await flush()

    expect(el.textContent).toContain('未能识别标题，请手动填写')
    expect(descInput(el).value).toBe('只有描述')
  })

  it('同一 URL 成功后再次失焦不重复请求', async () => {
    getMeta.mockResolvedValue({ title: '示例站点', description: '' })
    const { el } = await mountForm()

    setUrl(el, 'https://example.com')
    blurUrl(el)
    await flush()
    blurUrl(el)
    await flush()

    expect(getMeta).toHaveBeenCalledTimes(1)
  })

  it('名称与描述都已有内容时不发起获取', async () => {
    getMeta.mockResolvedValue({ title: '抓取标题', description: '抓取描述' })
    const { el } = await mountForm({
      bookmark: { url: 'https://example.com', title: '已有名称', description: '已有描述', category_id: null }
    })

    blurUrl(el)
    await flush()

    expect(getMeta).not.toHaveBeenCalled()
    expect(titleInput(el).disabled).toBe(false)
  })

  it('获取中修改 URL 中止在途请求并解禁，再次失焦按新网址获取', async () => {
    const signals = []
    getMeta.mockImplementation((_url, signal) => new Promise((_resolve, reject) => {
      signals.push(signal)
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const { el } = await mountForm()

    setUrl(el, 'https://example.com')
    blurUrl(el)
    await nextTick()
    expect(titleInput(el).disabled).toBe(true)

    setUrl(el, 'https://new.example.com')
    await flush()
    expect(signals[0].aborted).toBe(true)
    expect(titleInput(el).disabled).toBe(false)
    expect(el.textContent).not.toContain('正在获取网站信息…')

    getMeta.mockResolvedValue({ title: '新站', description: '' })
    blurUrl(el)
    await flush()
    expect(getMeta.mock.calls[1][0]).toBe('https://new.example.com')
    expect(titleInput(el).value).toBe('新站')
  })

  it('非法协议 URL 失焦不发起获取', async () => {
    getMeta.mockResolvedValue({ title: '抓取标题', description: '抓取描述' })
    const { el } = await mountForm()

    setUrl(el, 'javascript:alert(1)')
    blurUrl(el)
    await flush()

    expect(getMeta).not.toHaveBeenCalled()
    expect(titleInput(el).disabled).toBe(false)
  })
})
