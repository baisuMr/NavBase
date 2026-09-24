// 登录端点单测：凭据校验、token 与过期时间、fail-closed
import { describe, it, expect } from 'vitest'
import { handle } from './login.js'

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
    const res = await handle(makeRequest({ username: 'admin', password: 'wrong' }), ENV)
    expect(res.status).toBe(401)
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
