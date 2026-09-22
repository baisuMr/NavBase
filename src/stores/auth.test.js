// @vitest-environment happy-dom
// 认证状态 store 单测（含记住设备分流）
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('无 token 时未认证，init 不改变状态', () => {
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBe('')
  })

  it('localStorage 中过期 token 会被 init 清除', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', String(Date.now() - 1000))
    localStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('localStorage 中未过期的 token 恢复登录态', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    localStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(true)
    expect(store.username).toBe('admin')
  })

  it('sessionStorage 中未过期的 token 也能恢复登录态', () => {
    sessionStorage.setItem('auth_token', 'abc')
    sessionStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    sessionStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(true)
    expect(store.username).toBe('admin')
  })

  it('localStorage 优先于 sessionStorage', () => {
    localStorage.setItem('auth_token', 'local')
    localStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    sessionStorage.setItem('auth_token', 'session')
    sessionStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    const store = useAuthStore()
    store.init()
    expect(store.token).toBe('local')
  })

  it('getAuthHeaders 注入 Basic 头', () => {
    const store = useAuthStore()
    expect(store.getAuthHeaders()).toEqual({})
    store.token = 'abc'
    expect(store.getAuthHeaders()).toEqual({ Authorization: 'Basic abc' })
  })

  it('clearAuth 清空状态与两处存储', () => {
    localStorage.setItem('auth_token', 'a')
    localStorage.setItem('auth_expires_at', '1')
    sessionStorage.setItem('auth_token', 'b')
    const store = useAuthStore()
    store.token = 'a'
    store.expiresAt = 1
    store.clearAuth()
    expect(store.token).toBe('')
    expect(store.expiresAt).toBe(0)
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_expires_at')).toBeNull()
    expect(sessionStorage.getItem('auth_token')).toBeNull()
  })

  it('remember=true 登录写入 localStorage 且请求携带 remember', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'tok', expiresAt: Date.now() + 30 * 86400_000, durationDays: 30,
      remember: true, username: 'admin', success: true
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    // 预置另一存储的残留，锁定登录后的交叉清理
    sessionStorage.setItem('auth_token', 'stale')

    const store = useAuthStore()
    const r = await store.login('admin', 'pw', true)
    expect(r.success).toBe(true)
    expect(r.remember).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('auth_token')).toBe('tok')
    expect(sessionStorage.getItem('auth_token')).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).remember).toBe(true)
    vi.unstubAllGlobals()
  })

  it('remember=false 登录写入 sessionStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'tok', expiresAt: Date.now() + 7 * 86400_000, durationDays: 7,
      remember: false, username: 'admin', success: true
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    // 预置另一存储的残留，锁定登录后的交叉清理
    localStorage.setItem('auth_token', 'stale')

    const store = useAuthStore()
    const r = await store.login('admin', 'pw')
    expect(r.success).toBe(true)
    expect(r.remember).toBe(false)
    expect(sessionStorage.getItem('auth_token')).toBe('tok')
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).remember).toBe(false)
    vi.unstubAllGlobals()
  })

  it('localStorage 过期 + sessionStorage 有效时，init 取 session 并清除过期残留', () => {
    localStorage.setItem('auth_token', 'expired')
    localStorage.setItem('auth_expires_at', String(Date.now() - 1000))
    sessionStorage.setItem('auth_token', 'tok-session')
    sessionStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    sessionStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(true)
    expect(store.token).toBe('tok-session')
    expect(store.username).toBe('admin')
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('登录失败抛出服务端错误信息', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: '用户名或密码错误' }), { status: 401 }
    )))
    const store = useAuthStore()
    await expect(store.login('admin', 'bad')).rejects.toThrow('用户名或密码错误')
    vi.unstubAllGlobals()
    consoleSpy.mockRestore()
  })
})
