// @vitest-environment happy-dom
// api 层请求收尾：15 秒超时兜底与 401 携带来源跳登录
import { describe, it, expect, beforeEach, vi } from 'vitest'

// 拦截认证 store：401 需走 clearAuth 既有语义，但测试里不依赖 Pinia 上下文与真实存储
const { clearAuth } = vi.hoisted(() => ({ clearAuth: vi.fn() }))
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ clearAuth, getAuthHeaders: () => ({}) })
}))

import { api } from './index'

describe('api 请求收尾', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  it('请求超过 15 秒抛出超时错误', async () => {
    // 模拟 AbortSignal.timeout(15000)：返回受控 signal，稍后中止表示到期
    const controller = new AbortController()
    const timeoutSpy = vi.fn(() => controller.signal)
    vi.stubGlobal('AbortSignal', { ...AbortSignal, timeout: timeoutSpy })

    // fetch 遵守中止信号（与真实 fetch 行为一致），下一个微任务即「到期」
    vi.stubGlobal('fetch', (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason))
      queueMicrotask(() => controller.abort(
        new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      ))
    }))

    await expect(api.get('/bookmarks')).rejects.toThrow(/超时/)
    // 必须以 15 秒超时中止请求，而不是裸 fetch 永久挂起
    expect(timeoutSpy).toHaveBeenCalledWith(15000)
  })

  it('401 跳转登录页时携带 redirect 来源', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }))
    window.history.pushState({}, '', '/?x=1')

    await expect(api.get('/bookmarks')).rejects.toThrow(/未授权/)

    // 跳登录带当前路径与查询串，登录后可回原页（回跳经 safeRedirectPath 校验）
    expect(window.location.href).toContain('/login?redirect=')
    expect(window.location.href).toContain(encodeURIComponent('/?x=1'))
    // 既有语义保留：401 先清登录态
    expect(clearAuth).toHaveBeenCalled()
  })

  it('正常响应返回解析后的 JSON', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await expect(api.get('/settings')).resolves.toEqual({ ok: true })
  })
})
