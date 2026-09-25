// 登录端点单测：凭据校验、token 与过期时间、fail-closed
import { describe, it, expect, vi, afterEach } from 'vitest'
import { handle } from './login.js'

// 假时钟用例兜底还原，防止泄漏到其它用例
afterEach(() => vi.useRealTimers())

const ENV = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 's3cret',
  LOGIN_DURATION_DAYS: '7',
  REMEMBER_DURATION_DAYS: '30'
}

function makeRequest(body, method = 'POST') {
  const init = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return new Request('http://test/api/auth/login', init)
}

describe('POST /api/auth/login', () => {
  it('正确凭据返回 token 与 7 天过期时间', async () => {
    const res = await handle(makeRequest({ username: 'admin', password: 's3cret' }), ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.token).toBe(btoa('admin:s3cret'))
    expect(data.username).toBe('admin')
    expect(data.durationDays).toBe(7)
    expect(data.remember).toBe(false)
    expect(data.success).toBe(true)
    expect(data.expiresAt - Date.now()).toBeGreaterThan(6 * 24 * 3600 * 1000)
    expect(data.expiresAt - Date.now()).toBeLessThanOrEqual(7 * 24 * 3600 * 1000)
  })

  it('勾选记住此设备使用 REMEMBER_DURATION_DAYS', async () => {
    const res = await handle(
      makeRequest({ username: 'admin', password: 's3cret', remember: true }),
      ENV
    )
    const data = await res.json()
    expect(data.durationDays).toBe(30)
    expect(data.remember).toBe(true)
  })

  it('错误凭据返回 401', async () => {
    // 假时钟跳过真实 800ms 防爆破等待；先等 digest 完成、定时器挂上假时钟再推钟。
    // secureCompare 的 crypto.subtle.digest 需若干真实事件循环轮次，全量并行下 CPU 满载时
    // 轮次需求会膨胀，故放宽空转上限；极端情况下退回真实时钟，避免 await p 挂到超时
    vi.useFakeTimers()
    const p = handle(makeRequest({ username: 'admin', password: 'wrong' }), ENV)
    for (let i = 0; i < 500 && vi.getTimerCount() === 0; i++) {
      await vi.advanceTimersByTimeAsync(0)
    }
    if (vi.getTimerCount() > 0) {
      await vi.advanceTimersByTimeAsync(801)
    } else {
      // 定时器迟迟未挂上：退回真实时钟让 800ms 延迟真实走完（慢但不 flake）
      vi.useRealTimers()
    }
    const res = await p
    expect(res.status).toBe(401)
  })

  it('登录失败响应延迟约 800ms 后才返回（防爆破）', async () => {
    vi.useFakeTimers()
    try {
      const p = handle(makeRequest({ username: 'admin', password: 'wrong' }), ENV)
      // 等 secureCompare 的 digest 完成、防爆破定时器挂上假时钟（只空转真实轮次，不移动时钟）；
      // 全量并行下 CPU 满载时轮次需求膨胀，故放宽上限
      for (let i = 0; i < 500 && vi.getTimerCount() === 0; i++) {
        await vi.advanceTimersByTimeAsync(0)
      }
      expect(vi.getTimerCount()).toBeGreaterThan(0) // 定时器未挂上时明确失败，避免 await p 挂死
      await vi.advanceTimersByTimeAsync(799)
      let settled = false
      p.then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(false) // 799ms 时还没返回
      await vi.advanceTimersByTimeAsync(1)
      const res = await p
      expect(res.status).toBe(401)
    } finally {
      vi.useRealTimers()
    }
  })

  it('LOGIN_DURATION_DAYS 非法时回退默认 7 天', async () => {
    // 误配成非数字时 parseInt 得 NaN，须回退默认，否则 expiresAt 为 null 被前端误判过期
    const res = await handle(
      makeRequest({ username: 'admin', password: 's3cret' }),
      { ...ENV, LOGIN_DURATION_DAYS: 'abc' }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.durationDays).toBe(7)
    expect(Number.isFinite(body.expiresAt)).toBe(true)
  })

  it('LOGIN_DURATION_DAYS 为 0 或负数时回退默认 7 天', async () => {
    for (const bad of ['0', '-5']) {
      const res = await handle(
        makeRequest({ username: 'admin', password: 's3cret' }),
        { ...ENV, LOGIN_DURATION_DAYS: bad }
      )
      const body = await res.json()
      expect(body.durationDays, bad).toBe(7)
    }
  })

  it('REMEMBER_DURATION_DAYS 非法时回退默认 30 天', async () => {
    const res = await handle(
      makeRequest({ username: 'admin', password: 's3cret', remember: true }),
      { ...ENV, REMEMBER_DURATION_DAYS: 'abc' }
    )
    const body = await res.json()
    expect(body.durationDays).toBe(30)
    expect(Number.isFinite(body.expiresAt)).toBe(true)
  })

  it('空用户名或密码返回 400', async () => {
    expect((await handle(makeRequest({ username: '', password: 'x' }), ENV)).status).toBe(400)
    expect((await handle(makeRequest({ username: 'admin' }), ENV)).status).toBe(400)
  })

  it('未配置密码返回 500', async () => {
    const res = await handle(makeRequest({ username: 'admin', password: 'x' }), {
      ...ENV,
      ADMIN_PASSWORD: undefined
    })
    expect(res.status).toBe(500)
  })

  it('非 POST（含 OPTIONS）返回 405', async () => {
    expect((await handle(makeRequest(undefined, 'GET'), ENV)).status).toBe(405)
    expect((await handle(makeRequest(undefined, 'OPTIONS'), ENV)).status).toBe(405)
  })

  it('非法 JSON 请求体返回 500', async () => {
    const res = await handle(makeRequest('not-json', 'POST'), ENV)
    expect(res.status).toBe(500)
  })
})
