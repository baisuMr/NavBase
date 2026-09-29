// @vitest-environment happy-dom
// 书签拖动排序防误开链接：拖拽结束短暂窗口内只吞被拖卡片上的点击，
// 其他按钮/链接的点击不受影响（此前 document 级一律吞掉，导致拖完即点按钮失灵一次）
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import BookmarkExplorer from './BookmarkExplorer.vue'

const hoisted = vi.hoisted(() => ({ sortableOpts: [] }))

vi.mock('sortablejs', () => ({
  default: {
    create: (_el, opts) => {
      hoisted.sortableOpts.push(opts)
      return { destroy: () => {} }
    }
  }
}))

vi.mock('./BookmarkCard.vue', () => ({
  default: {
    name: 'BookmarkCardStub',
    props: ['bookmark'],
    render() {
      return h('a', {
        class: 'bookmark-card',
        'data-id': this.bookmark.id,
        href: this.bookmark.url
      }, this.bookmark.title)
    }
  }
}))

const apps = []
async function mountExplorer() {
  hoisted.sortableOpts.length = 0
  const app = createApp({
    setup() {
      return () => h(BookmarkExplorer, {
        bookmarks: [
          { id: 1, title: 'A 站', url: 'https://a.com', category_id: 1 },
          { id: 2, title: 'B 站', url: 'https://b.com', category_id: 1 }
        ],
        categories: [{ id: 1, name: '分类一', icon: 'ri-folder-line', color: '#2563EB' }],
        activeCat: 1
      })
    }
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  apps.push(app)
  // onMounted 内动态 import sortablejs：宏任务等待其解析完成，再刷新一轮挂上 Sortable
  await new Promise((resolve) => setTimeout(resolve, 0))
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await nextTick()
  return el
}

// 模拟一次拖拽结束（先 onStart 记录原位，再 onEnd 还原 DOM 并触发防误开逻辑）
function simulateGridDragEnd(el) {
  const gridOpts = hoisted.sortableOpts.find((o) => o.draggable === '.bookmark-card')
  const grid = el.querySelector('.bookmark-grid')
  const card = grid.querySelector('.bookmark-card')
  gridOpts.onStart({ item: card })
  gridOpts.onEnd({ item: card, from: grid, oldDraggableIndex: 0, newDraggableIndex: 1 })
  return card
}

// 模拟一次分类 tab 拖拽结束
function simulateTabDragEnd(el) {
  const tabOpts = hoisted.sortableOpts.find((o) => o.draggable === '.category-tab-cat')
  const tab = el.querySelector('.category-tab-cat')
  tabOpts.onStart({ item: tab })
  tabOpts.onEnd({ item: tab, from: tab.parentElement, oldDraggableIndex: 0, newDraggableIndex: 1 })
  return tab
}

function clickOn(target) {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

afterEach(() => {
  apps.forEach((app) => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
})

describe('BookmarkExplorer 拖拽防误开链接', () => {
  it('拖拽结束后点击被拖卡片的误触发 click 被吞（防误开链接）', async () => {
    const el = await mountExplorer()
    const card = simulateGridDragEnd(el)
    const e = clickOn(card)
    expect(e.defaultPrevented).toBe(true)
  })

  it('拖拽结束后点其他按钮不受影响（不吞无关点击）', async () => {
    const el = await mountExplorer()
    simulateGridDragEnd(el)
    const e = clickOn(el.querySelector('.explorer-add-btn'))
    expect(e.defaultPrevented).toBe(false)
  })

  it('分类 tab 拖拽结束误触发的点击被吞（防误切分类）', async () => {
    const el = await mountExplorer()
    const tab = simulateTabDragEnd(el)
    const e = clickOn(tab)
    expect(e.defaultPrevented).toBe(true)
  })

  // CSS 视觉（浮起/占位/光标）无法单测，人工验收；此处锁定可测的 Sortable 配置防回归
  it('拖拽动画配置：让位滑动 250ms + 缓动曲线，fallback 拖拽使浮起样式可控', async () => {
    await mountExplorer()
    const gridOpts = hoisted.sortableOpts.find((o) => o.draggable === '.bookmark-card')
    const tabOpts = hoisted.sortableOpts.find((o) => o.draggable === '.category-tab-cat')
    for (const opts of [gridOpts, tabOpts]) {
      expect(opts.animation).toBe(250)
      expect(opts.easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')
      // 桌面默认走 HTML5 原生拖影（CSS 不可控），须强制 fallback 才能做浮起与光标
      expect(opts.forceFallback).toBe(true)
    }
  })

  it('原生 dragstart 被取消：链接卡片的浏览器默认拖拽不与 Sortable fallback 抢占', async () => {
    const el = await mountExplorer()
    const card = el.querySelector('.bookmark-card')
    // fallback 模式下 Sortable 不拦截 dragstart，a[href] 的原生链接拖拽会抢占导致拖动偶发失效
    const e = new Event('dragstart', { bubbles: true, cancelable: true })
    card.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})
