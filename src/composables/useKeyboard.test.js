// @vitest-environment happy-dom
// 全局快捷键：Alt+K 搜索、Alt+N 添加书签、Alt+Shift+N 添加分类、Escape 关闭
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, h } from 'vue'
import { useKeyboard } from './useKeyboard'

function mountWithKeyboard(handlers) {
  const app = createApp({
    setup() {
      useKeyboard(handlers)
      return () => h('div')
    }
  })
  const el = document.createElement('div')
  app.mount(el)
  return app
}

function press(opts) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts }))
}

const apps = []
function mount(handlers) {
  const app = mountWithKeyboard(handlers)
  apps.push(app)
  return app
}

afterEach(() => {
  apps.forEach((app) => app.unmount())
  apps.length = 0
})

describe('useKeyboard', () => {
  it('Alt+K 触发聚焦搜索', () => {
    const search = vi.fn()
    mount({ search })
    press({ key: 'k', code: 'KeyK', altKey: true })
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+K 不再触发搜索（与输入法/扩展冲突，已改用 Alt+K）', () => {
    const search = vi.fn()
    mount({ search })
    press({ key: 'k', code: 'KeyK', ctrlKey: true })
    expect(search).not.toHaveBeenCalled()
  })

  it('Alt+N 触发添加书签，Alt+Shift+N 触发添加分类', () => {
    const addBookmark = vi.fn()
    const addCategory = vi.fn()
    mount({ addBookmark, addCategory })
    press({ key: 'n', code: 'KeyN', altKey: true })
    press({ key: 'n', code: 'KeyN', altKey: true, shiftKey: true })
    expect(addBookmark).toHaveBeenCalledTimes(1)
    expect(addCategory).toHaveBeenCalledTimes(1)
  })

  it('Escape 触发关闭', () => {
    const close = vi.fn()
    mount({ close })
    press({ key: 'Escape', code: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Alt+N（AltGr）不触发新建书签，也不拦截默认输入', () => {
    const addBookmark = vi.fn()
    mount({ addBookmark })
    const e = new KeyboardEvent('keydown', {
      code: 'KeyN', altKey: true, ctrlKey: true, bubbles: true, cancelable: true
    })
    window.dispatchEvent(e)
    expect(addBookmark).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('Ctrl+Alt+Shift+N 不触发添加分类', () => {
    const addCategory = vi.fn()
    mount({ addCategory })
    press({ code: 'KeyN', altKey: true, ctrlKey: true, shiftKey: true })
    expect(addCategory).not.toHaveBeenCalled()
  })
})
