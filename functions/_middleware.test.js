// Basic Auth 中间件单测：重点回归路径归一化后的认证绕过防护
import { describe, it, expect, vi } from 'vitest'
import { onRequest } from './_middleware.js'

const SECRET = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 's3cret' }
const basic = (u, p) => 'Basic ' + btoa(`${u}:${p}`)

function makeContext(path, headers = {}, env = SECRET) {
  return {
    request: new Request(`https://example.com${path}`, { headers }),
    env,
    params: {}
  }
}
const next = vi.fn(() => new Response('next-content', { status: 200 }))
const run = async (ctx) => {
  next.mockClear()
  const res = await onRequest({ ...ctx, next })
  return res
}

describe('认证正常路径', () => {
  it('带正确凭据访问 API 放行到 next', async () => {
    const res = await run(makeContext('/api/bookmarks', { Authorization: basic('admin', 's3cret') }))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('next-content')
  })

  it('无凭据访问 API 返回 401', async () => {
    const res = await run(makeContext('/api/bookmarks'))
    expect(res.status).toBe(401)
  })

  it('错误凭据返回 401', async () => {
    const res = await run(makeContext('/api/bookmarks', { Authorization: basic('admin', 'wrong') }))
    expect(res.status).toBe(401)
  })

  it('非 Basic 方案返回 401', async () => {
    const res = await run(makeContext('/api/bookmarks', { Authorization: 'Bearer xyz' }))
    expect(res.status).toBe(401)
  })

  it('非法 base64 返回 401 而非崩溃', async () => {
    const res = await run(makeContext('/api/bookmarks', { Authorization: 'Basic !!!bad' }))
    expect(res.status).toBe(401)
  })

  it('未配置密码时 fail-closed 返回 500', async () => {
    const res = await run(makeContext('/api/bookmarks', { Authorization: basic('admin', 'x') }, {}))
    expect(res.status).toBe(500)
  })

  it('OPTIONS 预检直接放行', async () => {
    const res = await run({
      request: new Request('https://example.com/api/bookmarks', { method: 'OPTIONS' }),
      env: SECRET,
      params: {},
      next
    })
    expect(res.status).toBe(200)
  })

  it('登录接口精确豁免认证', async () => {
    const res = await run(makeContext('/api/auth/login'))
    expect(res.status).toBe(200)
  })

  it('登录接口尾斜杠不豁免', async () => {
    const res = await run(makeContext('/api/auth/login/'))
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
      const res = await run(makeContext(path))
      expect(res.status).toBe(401)
    })
  }

  it('静态资源路径正常放行', async () => {
    for (const path of ['/', '/login', '/assets/index.js', '/favicon.ico', '/schema.sql']) {
      const res = await run(makeContext(path))
      expect(res.status).toBe(200)
    }
  })
})
