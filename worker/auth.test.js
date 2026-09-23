// Basic Auth 认证门单测：重点回归路径归一化后的认证绕过防护
// （原 Pages _middleware.test.js，按 authGate 契约改造：返回 null 表示放行）
import { describe, it, expect } from 'vitest'
import { authGate } from './auth.js'

const SECRET = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 's3cret' }
const basic = (u, p) => 'Basic ' + btoa(`${u}:${p}`)

function makeRequest(path, headers = {}) {
  return new Request(`https://example.com${path}`, { headers })
}
const run = (path, headers = {}, env = SECRET) => authGate(makeRequest(path, headers), env)

describe('认证正常路径', () => {
  it('带正确凭据访问 API 放行（返回 null）', async () => {
    const res = await run('/api/bookmarks', { Authorization: basic('admin', 's3cret') })
    expect(res).toBeNull()
  })

  it('无凭据访问 API 返回 401', async () => {
    const res = await run('/api/bookmarks')
    expect(res.status).toBe(401)
  })

  it('错误凭据返回 401', async () => {
    const res = await run('/api/bookmarks', { Authorization: basic('admin', 'wrong') })
    expect(res.status).toBe(401)
  })

  it('非 Basic 方案返回 401', async () => {
    const res = await run('/api/bookmarks', { Authorization: 'Bearer xyz' })
    expect(res.status).toBe(401)
  })

  it('非法 base64 返回 401 而非崩溃', async () => {
    const res = await run('/api/bookmarks', { Authorization: 'Basic !!!bad' })
    expect(res.status).toBe(401)
  })

  it('未配置密码时 fail-closed 返回 500', async () => {
    const res = await run('/api/bookmarks', { Authorization: basic('admin', 'x') }, {})
    expect(res.status).toBe(500)
  })

  it('OPTIONS 预检直接放行', async () => {
    const res = await authGate(
      new Request('https://example.com/api/bookmarks', { method: 'OPTIONS' }),
      SECRET
    )
    expect(res).toBeNull()
  })

  it('登录接口精确豁免认证', async () => {
    expect(await run('/api/auth/login')).toBeNull()
  })

  it('登录接口尾斜杠不豁免', async () => {
    const res = await run('/api/auth/login/')
    expect(res.status).toBe(401)
  })
})

describe('路径归一化防绕过（历史 P0 回归）', () => {
  const cases = [
    ['/API/bookmarks', '大写'],
    ['/Api/Bookmarks', '混合大小写'],
    ['//api/bookmarks', '双斜杠'],
    ['/api%2Fbookmarks', '编码斜杠大写'],
    ['/api%2fbookmarks', '编码斜杠小写'],
    ['/api/auth/login/', '登录尾斜杠']
  ]
  for (const [path, label] of cases) {
    it(`${label}变体 ${path} 返回 401 而非放行`, async () => {
      const res = await run(path)
      expect(res.status).toBe(401)
    })
  }

  it('静态资源路径正常放行', async () => {
    for (const path of ['/', '/login', '/assets/index.js', '/favicon.ico', '/schema.sql']) {
      expect(await run(path), path).toBeNull()
    }
  })
})
