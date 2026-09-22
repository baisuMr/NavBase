// 书签排序行为：新建/导入排最后（sort_order = MAX+1 起递增），编辑不改排序
import { describe, it, expect } from 'vitest'
import { onRequest } from './index.js'
import { onRequest as onItemRequest } from './[id].js'
import { onRequest as onBatchRequest } from './batch.js'
import { createMockDB } from '../../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

describe('书签排序', () => {
  it('创建书签的 sort_order 取 MAX+1（新书签排最后），不接受传入值', async () => {
    const db = createMockDB()
    const res = await onRequest({
      request: new Request('http://test/api/bookmarks', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ title: 't', url: 'https://a.com', sort_order: 0 })
      }),
      env: { DB: db }
    })
    expect(res.status).toBe(201)
    const insert = db.calls.find(c => c.sql.includes('INSERT INTO bookmarks'))
    expect(insert.sql).toMatch(/COALESCE\(MAX\(sort_order\),\s*0\)\s*\+\s*1/i)
    // sort_order 不走 bind：title/url/description/category_id/icon_url 五个参数
    expect(insert.args.length).toBe(5)
  })

  it('更新书签不改动 sort_order（保留原排序）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
    })
    const res = await onItemRequest({
      request: new Request('http://test/api/bookmarks/1', {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ title: 't2', url: 'https://b.com', sort_order: 99 })
      }),
      env: { DB: db },
      params: { id: '1' }
    })
    expect(res.status).toBe(200)
    const update = db.calls.find(c => c.sql.includes('UPDATE bookmarks'))
    expect(update.sql).not.toMatch(/sort_order/)
    expect(update.args).not.toContain(99)
  })

  it('批量导入的 sort_order 从 MAX+1 起按导入顺序递增', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('WHERE url IN')) return { results: [] }
      if (method === 'first' && sql.includes('MAX(sort_order)')) return { max: 5 }
    })
    const res = await onBatchRequest({
      request: new Request('http://test/api/bookmarks/batch', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          bookmarks: [
            { title: 'a', url: 'https://a.com' },
            { title: 'b', url: 'https://b.com' },
            { title: 'c', url: 'https://c.com' }
          ]
        })
      }),
      env: { DB: db }
    })
    expect(res.status).toBe(200)
    const inserts = db.calls.filter(c => c.sql.includes('INSERT INTO bookmarks'))
    expect(inserts.length).toBe(3)
    // sort_order 是 bind 的第 6 个参数，从 6 开始递增（库内 MAX=5）
    expect(inserts.map(c => c.args[5])).toEqual([6, 7, 8])
  })
})
