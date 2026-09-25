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
    const batchBody = await res.json()
    expect(batchBody.error).toContain('bookmarks')
    expect(batchBody.code).toBe('VALIDATION_ERROR')
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
    const sortBody = await res.json()
    expect(sortBody.error).toBe('排序字段不正确')
    expect(sortBody.code).toBe('VALIDATION_ERROR')
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

  it('未命中的 /api/* 路径返回 404 JSON 而非 SPA 页面', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/api/bookmarkz', { headers: AUTH }), env, {})
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    const body = await res.json()
    expect(body.error).toBe('接口不存在')
    expect(body.code).toBe('NOT_FOUND')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('未命中的 /API/* 大小写变体同样返回 404 JSON', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/API/bookmarkz', { headers: AUTH }), env, {})
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('NOT_FOUND')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
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
    expect(env.DB.calls.some(c => c.method === 'run' && c.sql.includes('CREATE TABLE'))).toBe(true)
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
      if (method === 'run') throw new Error('boom')
    }))
    const res = await w.fetch(req('/api/bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('数据库初始化失败')
    expect(body.code).toBe('DB_INIT_FAILED')
  })
})

describe('API 错误契约统一（{ error, code }）', () => {
  it('各路由 405 统一返回请求方法不支持 + METHOD_NOT_ALLOWED', async () => {
    const env = makeEnv()
    const cases = [
      ['/api/bookmarks', 'DELETE'],
      ['/api/bookmarks/batch', 'GET'],
      ['/api/bookmarks/1', 'PATCH'],
      ['/api/categories', 'DELETE'],
      ['/api/categories/sort', 'GET'],
      ['/api/categories/1', 'PATCH']
    ]
    for (const [path, method] of cases) {
      const label = `${method} ${path}`
      const res = await worker.fetch(req(path, { method, headers: AUTH }), env, {})
      expect(res.status, label).toBe(405)
      expect(await res.json(), label).toEqual({
        error: '请求方法不支持',
        code: 'METHOD_NOT_ALLOWED'
      })
    }
  })

  it('书签不存在返回 404 + NOT_FOUND', async () => {
    const env = makeEnv() // first() 默认 null → 书签不存在
    const res = await worker.fetch(req('/api/bookmarks/999', { headers: AUTH }), env, {})
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: '书签不存在', code: 'NOT_FOUND' })
  })

  it('分类不存在返回 404 + NOT_FOUND（写入校验的 400 仍为 CATEGORY_NOT_FOUND）', async () => {
    const env = makeEnv()
    const res = await worker.fetch(req('/api/categories/999', { headers: AUTH }), env, {})
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: '分类不存在', code: 'NOT_FOUND' })
  })
})
