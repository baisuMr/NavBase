// @vitest-environment happy-dom
// Toast 计时：同文案连续触发时靠 seq 变化重置定时器，防止第二条提示提前消失
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, reactive, nextTick } from 'vue'
import ToastMessage from './ToastMessage.vue'

function mountToast() {
  const props = reactive({ message: '', type: 'success', seq: 0, duration: 2400 })
  const onClose = vi.fn()
  const app = createApp({
    setup() {
      return () => h(ToastMessage, { ...props, onClose })
    }
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  return { props, onClose, app }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ToastMessage 计时重置', () => {
  it('同文案再次触发（seq 递增）时重置定时器，不提前关闭', async () => {
    const { props, onClose, app } = mountToast()

    // 第一次触发
    props.message = '链接已复制'
    props.seq = 1
    await nextTick()
    expect(onClose).not.toHaveBeenCalled()

    // 计时进行到 1000ms 时同文案第二次触发
    vi.advanceTimersByTime(1000)
    props.seq = 2
    await nextTick()

    // 距首次触发已 3399ms（> 2400）：修复前旧定时器未重置会已关闭
    vi.advanceTimersByTime(2399)
    expect(onClose).not.toHaveBeenCalled()

    // 距第二次触发满 2400ms → 正常关闭
    vi.advanceTimersByTime(2)
    expect(onClose).toHaveBeenCalledTimes(1)

    app.unmount()
  })

  it('不同文案触发同样重置定时器（原有行为回归）', async () => {
    const { props, onClose, app } = mountToast()

    props.message = '第一条'
    props.seq = 1
    await nextTick()
    vi.advanceTimersByTime(2000)

    props.message = '第二条'
    props.seq = 2
    await nextTick()
    vi.advanceTimersByTime(2399)
    expect(onClose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2)
    expect(onClose).toHaveBeenCalledTimes(1)

    app.unmount()
  })
})
