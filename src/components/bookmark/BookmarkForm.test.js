// @vitest-environment happy-dom
// 分类平铺按钮（替代下拉选择）：渲染未分类+各分类按钮、点击选中、提交携带 category_id
import { describe, it, expect, afterEach } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
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
