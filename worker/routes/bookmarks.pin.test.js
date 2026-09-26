// 书签固定到首屏：is_pinned 字段校验、写入与上限 10
import { describe, it, expect } from 'vitest'
import { validateBookmarkPayload } from '../utils/validate.js'
import { item, batch } from './bookmarks.js'
import { createMockDB } from '../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

describe('validateBookmark is_pinned 字段校验', () => {
  it('is_pinned 缺省（undefined/null）或 0/1/布尔值时通过', () => {
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com' })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: null })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: 0 })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: 1 })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: true })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: false })).toBeNull()
  })

  it('is_pinned 为非法类型时返回错误', () => {
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: 2 })).toMatch(/固定/)
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: 'yes' })).toMatch(/固定/)
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: {} })).toMatch(/固定/)
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', is_pinned: [] })).toMatch(/固定/)
  })
})

describe('更新书签写入 is_pinned', () => {
  it('显式传 is_pinned 时写入该列（固定标记归一为 0/1）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', is_pinned: true })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(200)
    const update = db.calls.find(c => c.sql.includes('UPDATE bookmarks'))
    expect(update.sql).toMatch(/is_pinned = \?/)
    expect(update.args).toContain(1)
  })

  it('缺省 is_pinned 时不修改该列（编辑书签保留固定状态）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com' })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(200)
    const update = db.calls.find(c => c.sql.includes('UPDATE bookmarks'))
    expect(update.sql).not.toMatch(/is_pinned/)
  })

  it('显式传 is_pinned: 0 时取消固定', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', is_pinned: 0 })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(200)
    const update = db.calls.find(c => c.sql.includes('UPDATE bookmarks'))
    expect(update.sql).toMatch(/is_pinned = \?/)
    expect(update.args).toContain(0)
  })
})

describe('固定上限 10', () => {
  // 库内已有 10 个固定（不含目标书签）时的 mock：存在性 + COUNT
  const fullMock = ({ sql, method }) => {
    if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    if (method === 'first' && sql.includes('is_pinned = 1')) return { n: 10 }
  }

  it('固定第 11 个书签时返回 400', async () => {
    const db = createMockDB(fullMock)
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', is_pinned: 1 })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/最多固定/)
    expect(body.code).toBe('VALIDATION_ERROR')
    // 超限时不得写库
    expect(db.calls.find(c => c.sql.includes('UPDATE bookmarks'))).toBeUndefined()
  })

  it('已固定的书签在满员时仍可更新（重复传 is_pinned: 1 不算新增）', async () => {
    // COUNT 排除自身（id != ?）：满 10 含自身时他人计数为 9，应放行
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
      if (method === 'first' && sql.includes('is_pinned = 1')) return { n: 9 }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', is_pinned: 1 })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(200)
  })

  it('取消固定不受上限影响', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com', is_pinned: 0 })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(200)
    // 取消固定不触发计数查询
    expect(db.calls.find(c => c.sql.includes('is_pinned = 1'))).toBeUndefined()
  })
})

describe('批量导入不固定', () => {
  it('导入项即使携带 is_pinned 也不写入（默认未固定）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('WHERE url IN')) return { results: [] }
    })
    const res = await batch(new Request('http://test/api/bookmarks/batch', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        bookmarks: [{ title: 'a', url: 'https://a.com', is_pinned: 1 }]
      })
    }), { DB: db })
    expect(res.status).toBe(200)
    const insert = db.calls.find(c => /INSERT( OR IGNORE)? INTO bookmarks/.test(c.sql))
    expect(insert.sql).not.toMatch(/is_pinned/)
  })
})
