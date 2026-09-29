// @vitest-environment happy-dom
// Modal 关闭交互：Esc 关闭（输入法组合态不关闭，与 useKeyboard 全局守卫对齐）
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, h } from 'vue'
import Modal from './Modal.vue'

const apps = []
function mountModal(onClose) {
  const app = createApp({
    setup() {
      return () => h(Modal, { title: '测试', onClose })
    }
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  apps.push(app)
  return el
}

function pressEsc(target, { composing = false } = {}) {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  if (composing) Object.defineProperty(e, 'isComposing', { value: true })
  target.dispatchEvent(e)
  return e
}

afterEach(() => {
  apps.forEach((app) => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
})

describe('Modal Esc 关闭', () => {
  it('Esc 触发 close', () => {
    const onClose = vi.fn()
    const el = mountModal(onClose)
    pressEsc(el.querySelector('.modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('输入法组合态按 Esc 取消候选词不关闭弹窗', () => {
    const onClose = vi.fn()
    const el = mountModal(onClose)
    pressEsc(el.querySelector('.modal'), { composing: true })
    expect(onClose).not.toHaveBeenCalled()
  })
})
