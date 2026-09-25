// category_id 存在性校验：不存在的分类返回 400 而非撞外键兜底成 500
// 书签单资源 CRUD 分支：GET/DELETE 命中与 404、PUT 404、POST 创建 201、405 方法拒绝
import { describe, it, expect } from 'vitest'
import { collection, item } from './bookmarks.js'
import { createMockDB } from '../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

describe('category_id 存在性校验', () => {
  it('创建书签携带不存在的分类 id 返回 400', async () => {
    const db = createMockDB() // first() 默认 null → 分类不存在
    const res = await collection(new Request('http://test/api/bookmarks', {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', category_id: 999 })
    }), { DB: db })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('分类不存在')
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
    expect(db.calls.find(c => c.sql.includes('INSERT INTO bookmarks'))).toBeUndefined()
  })

  it('更新书签携带不存在的分类 id 返回 400', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT', headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', category_id: 999 })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('分类不存在')
    expect(body.code).toBe('CATEGORY_NOT_FOUND')
    // 校验失败不得写库
    expect(db.calls.find(c => c.sql.includes('UPDATE bookmarks'))).toBeUndefined()
  })
})

describe('书签单资源 CRUD 分支', () => {
  it('GET 单条：命中返回 200 书签数据，不存在返回 404', async () => {
    // 命中：first() 返回书签行
    const hitDb = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('FROM bookmarks b')) return { id: 1, title: 't', url: 'https://a.com' }
    })
    const hitRes = await item(new Request('http://test/api/bookmarks/1', { method: 'GET' }), { DB: hitDb }, { id: '1' })
    expect(hitRes.status).toBe(200)
    expect(await hitRes.json()).toMatchObject({ id: 1, title: 't' })

    // 404：first() 默认返回 null
    const missDb = createMockDB()
    const missRes = await item(new Request('http://test/api/bookmarks/999', { method: 'GET' }), { DB: missDb }, { id: '999' })
    expect(missRes.status).toBe(404)
    const body = await missRes.json()
    expect(body.error).toBe('书签不存在')
    expect(body.code).toBe('NOT_FOUND')
    // 查询分支不写库
    expect(missDb.calls.some(c => c.method === 'run')).toBe(false)
  })

  it('DELETE 单条：命中执行删除返回 200，不存在返回 404 且不写库', async () => {
    // 命中：存在性检查通过后执行 DELETE
    const hitDb = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const hitRes = await item(new Request('http://test/api/bookmarks/1', { method: 'DELETE' }), { DB: hitDb }, { id: '1' })
    expect(hitRes.status).toBe(200)
    expect(await hitRes.json()).toEqual({ success: true })
    expect(hitDb.calls.find(c => c.sql.includes('DELETE FROM bookmarks'))).toBeDefined()

    // 404：存在性检查失败，不得执行 DELETE
    const missDb = createMockDB()
    const missRes = await item(new Request('http://test/api/bookmarks/999', { method: 'DELETE' }), { DB: missDb }, { id: '999' })
    expect(missRes.status).toBe(404)
    const body = await missRes.json()
    expect(body.error).toBe('书签不存在')
    expect(body.code).toBe('NOT_FOUND')
    expect(missDb.calls.find(c => c.sql.includes('DELETE FROM bookmarks'))).toBeUndefined()
  })

  it('PUT 单条：书签不存在返回 404 且不写库', async () => {
    // 存在性检查 first() 默认 null → 404
    const db = createMockDB()
    const res = await item(new Request('http://test/api/bookmarks/999', {
      method: 'PUT', headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com' })
    }), { DB: db }, { id: '999' })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('书签不存在')
    expect(body.code).toBe('NOT_FOUND')
    // 不存在时不得写库
    expect(db.calls.find(c => c.sql.includes('UPDATE bookmarks'))).toBeUndefined()
  })

  it('POST 创建成功返回 201 与 { id, success }', async () => {
    // 不带 category_id 跳过分类校验；run() 默认返回 last_row_id 1
    const db = createMockDB()
    const res = await collection(new Request('http://test/api/bookmarks', {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com' })
    }), { DB: db })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 1, success: true })
    expect(db.calls.find(c => c.sql.includes('INSERT INTO bookmarks'))).toBeDefined()
  })

  it('不支持的方法返回 405 与 METHOD_NOT_ALLOWED', async () => {
    // 集合路由仅支持 GET/POST
    const colDb = createMockDB()
    const colRes = await collection(new Request('http://test/api/bookmarks', { method: 'DELETE' }), { DB: colDb })
    expect(colRes.status).toBe(405)
    const colBody = await colRes.json()
    expect(colBody.error).toBe('请求方法不支持')
    expect(colBody.code).toBe('METHOD_NOT_ALLOWED')
    expect(colDb.calls.some(c => c.method === 'run')).toBe(false)

    // 单条路由仅支持 GET/PUT/DELETE
    const itemDb = createMockDB()
    const itemRes = await item(new Request('http://test/api/bookmarks/1', { method: 'PATCH' }), { DB: itemDb }, { id: '1' })
    expect(itemRes.status).toBe(405)
    const itemBody = await itemRes.json()
    expect(itemBody.error).toBe('请求方法不支持')
    expect(itemBody.code).toBe('METHOD_NOT_ALLOWED')
    expect(itemDb.calls.some(c => c.method === 'run')).toBe(false)
  })
})
