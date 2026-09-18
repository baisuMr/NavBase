// @vitest-environment happy-dom
// 认证状态 store 单测
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('无 token 时未认证，init 不改变状态', () => {
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBe('')
  })

  it('过期 token 会被 init 清除', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', String(Date.now() - 1000))
    localStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('未过期的 token 恢复登录态', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    localStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(true)
    expect(store.username).toBe('admin')
  })

  it('getAuthHeaders 注入 Basic 头', () => {
    const store = useAuthStore()
    expect(store.getAuthHeaders()).toEqual({})
    store.token = 'abc'
    expect(store.getAuthHeaders()).toEqual({ Authorization: 'Basic abc' })
  })

  it('clearAuth 清空状态与 localStorage', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', '1')
    const store = useAuthStore()
    store.token = 'abc'
    store.expiresAt = 1
    store.clearAuth()
    expect(store.token).toBe('')
    expect(store.expiresAt).toBe(0)
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_expires_at')).toBeNull()
  })

  it('登录成功写入状态与 localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'tok', expiresAt: Date.now() + 86400_000, durationDays: 7, username: 'admin', success: true
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const store = useAuthStore()
    const r = await store.login('admin', 'pw')
    expect(r.success).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('auth_token')).toBe('tok')
    vi.unstubAllGlobals()
  })

  it('登录失败抛出服务端错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: '用户名或密码错误' }), { status: 401 }
    )))
    const store = useAuthStore()
    await expect(store.login('admin', 'bad')).rejects.toThrow('用户名或密码错误')
    vi.unstubAllGlobals()
  })
})
