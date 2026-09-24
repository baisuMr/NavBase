// Worker 入口路由冒烟：认证门集成、字面量路由优先、归一化匹配、ASSETS 兜底
import { describe, it, expect, vi } from 'vitest'
import worker from './index.js'
import { createMockDB } from './utils/mock-d1.js'

const basic = (u, p) => 'Basic ' + btoa(`${u}:${p}`)
const AUTH = { Authorization: basic('admin', 's3cret') }

function makeEnv(db = createMockDB()) {
  return {
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 's3cret',
    DB: db,
    ASSETS: { fetch: vi.fn(async () => new Response('asset-fallback', { status: 200 })) }
  }
}

const req = (path, init = {}) => new Request(`https://test.example${path}`, init)

describe('Worker 入口路由', () => {
  it('API 未带凭据被认证门拦截 401', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/api/bookmarks'), env, {})
    expect(res.status).toBe(401)
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('GET /api/bookmarks 分发到书签集合处理函数', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/api/bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(200)
    expect(env.DB.calls.some(c => c.sql.includes('FROM bookmarks'))).toBe(true)
  })

  it('POST /api/bookmarks/batch 走 batch 字面量路由而非 :id', async () => {
    const env = makeEnv()
    // 若误入 :id 路由会返回 405；batch 对空 bookmarks 返回 400
    const res = await worker.fetch(req('/api/bookmarks/batch', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: '{}'
    }), env, {})
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('bookmarks')
  })

  it('PUT /api/categories/sort 走 sort 字面量路由', async () => {
    const env = makeEnv()
    // sort 对非法形态返回固定文案；若误入 :id 路由会先做载荷校验（文案不同）
    const res = await worker.fetch(req('/api/categories/sort', {
      method: 'PUT',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: 'x' })
    }), env, {})
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('排序字段不正确')
  })

  it('路径大小写不敏感（/API/Bookmarks 归一化后命中书签路由）', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/API/Bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(200)
  })

  it('favicon 免认证：非法域名返回 400 而非 401', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/api/favicon/localhost'), env, {})
    expect(res.status).toBe(400)
  })

  it('未命中 API 的请求走 ASSETS 兜底（SPA）', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/some/spa/route'), env, {})
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('asset-fallback')
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1)
  })

  it('尾斜杠与重复斜杠归一化后命中同一处理函数', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('//api//bookmarks//', { headers: AUTH }), env, {})
    expect(res.status).toBe(200)
    expect(env.DB.calls.some(c => c.sql.includes('FROM bookmarks'))).toBe(true)
  })
})

describe('schema 自动初始化集成', () => {
  // schema-init 有模块级缓存，须与入口一起取全新模块实例
  const freshWorker = async () => {
    vi.resetModules()
    return (await import('./index.js')).default
  }

  it('首个 API 请求触发建表：探测 sqlite_master 并执行全量 schema', async () => {
    const w = await freshWorker()
    const env = makeEnv()
    const res = await w.fetch(req('/api/bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(200)
    expect(env.DB.calls.some(c => c.method === 'first' && c.sql.includes('sqlite_master'))).toBe(true)
    expect(env.DB.calls.some(c => c.method === 'exec' && c.sql.includes('CREATE TABLE'))).toBe(true)
  })

  it('favicon 请求不触发数据库初始化', async () => {
    const w = await freshWorker()
    const env = makeEnv()
    await w.fetch(req('/api/favicon/localhost'), env, {})
    expect(env.DB.calls).toHaveLength(0)
  })

  it('初始化失败返回 500 DB_INIT_FAILED', async () => {
    const w = await freshWorker()
    const env = makeEnv(createMockDB(({ method }) => {
      if (method === 'exec') throw new Error('boom')
    }))
    const res = await w.fetch(req('/api/bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('DB_INIT_FAILED')
  })
})
