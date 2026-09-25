// category_id 存在性校验：不存在的分类返回 400 而非撞外键兜底成 500
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
    // 校验失败不得写库
    expect(db.calls.find(c => c.sql.includes('UPDATE bookmarks'))).toBeUndefined()
  })
})
