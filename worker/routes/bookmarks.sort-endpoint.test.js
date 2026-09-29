// PUT /api/bookmarks/sort 书签分类内重排：按 ids 顺序换位 sort_order（数值集合不变，保护首屏常用站点跨分类顺序）
// 与新建/编辑的排序行为（bookmarks.sort.test.js）互不干扰：编辑仍不改 sort_order
import { describe, it, expect, vi } from 'vitest'
import { sort } from './bookmarks.js'
import { createMockDB } from '../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

function sortRequest(body) {
  return new Request('http://test/api/bookmarks/sort', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(body)
  })
}

// 库内书签行（id, category_id, sort_order）；SELECT ... WHERE id IN 按 bind 的 id 过滤返回
function mockDBWithBookmarks(rows) {
  return createMockDB(({ sql, args, method }) => {
    if (method === 'all' && sql.includes('WHERE id IN')) {
      return { results: rows.filter((r) => args.includes(r.id)) }
    }
  })
}

const ROWS = [
  { id: 1, category_id: 10, sort_order: 4 },
  { id: 2, category_id: 10, sort_order: 8 },
  { id: 3, category_id: 10, sort_order: 6 }
]

describe('书签重排 PUT /api/bookmarks/sort', () => {
  it('按 ids 顺序换位 sort_order（数值集合不变）', async () => {
    const db = mockDBWithBookmarks(ROWS)
    const res = await sort(sortRequest({ ids: [3, 1, 2] }), { DB: db })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    const updates = db.calls.filter((c) => c.method === 'run' && c.sql.includes('UPDATE bookmarks'))
    expect(updates.length).toBe(3)
    // SET sort_order = ? ... WHERE id = ? → args 为 [sort_order, id]；原值 [4,6,8] 按新顺序换位
    expect(updates.map((c) => c.args)).toEqual([
      [4, 3],
      [6, 1],
      [8, 2]
    ])
  })

  it('重排经由 D1 batch 事务执行', async () => {
    const db = mockDBWithBookmarks(ROWS)
    const spy = vi.spyOn(db, 'batch')
    await sort(sortRequest({ ids: [3, 1, 2] }), { DB: db })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].length).toBe(3)
  })

  it('跨分类 ids 返回 400（仅支持同一分类内重排）', async () => {
    const rows = [...ROWS, { id: 4, category_id: 20, sort_order: 9 }, { id: 5, category_id: null, sort_order: 10 }]
    for (const ids of [[1, 4], [1, 5]]) {
      const db = mockDBWithBookmarks(rows)
      const res = await sort(sortRequest({ ids }), { DB: db })
      expect(res.status, `ids=${JSON.stringify(ids)}`).toBe(400)
    }
  })

  it('未分类书签（category_id 为 null）可作为一组重排', async () => {
    const rows = [
      { id: 5, category_id: null, sort_order: 2 },
      { id: 6, category_id: null, sort_order: 7 }
    ]
    const db = mockDBWithBookmarks(rows)
    const res = await sort(sortRequest({ ids: [6, 5] }), { DB: db })
    expect(res.status).toBe(200)
    const updates = db.calls.filter((c) => c.method === 'run' && c.sql.includes('UPDATE bookmarks'))
    expect(updates.map((c) => c.args)).toEqual([
      [2, 6],
      [7, 5]
    ])
  })

  it('不存在的 id 返回 400', async () => {
    const db = mockDBWithBookmarks(ROWS)
    const res = await sort(sortRequest({ ids: [1, 99] }), { DB: db })
    expect(res.status).toBe(400)
  })

  it('重复 id 返回 400', async () => {
    const db = mockDBWithBookmarks(ROWS)
    const res = await sort(sortRequest({ ids: [1, 2, 1] }), { DB: db })
    expect(res.status).toBe(400)
  })

  it('非法 ids 形态返回 400', async () => {
    const bodies = [{}, { ids: null }, { ids: 'x' }, { ids: [] }, { ids: [0] }, { ids: [1.5] }, { ids: ['1'] }, { ids: [1, null] }]
    for (const body of bodies) {
      const db = mockDBWithBookmarks(ROWS)
      const res = await sort(sortRequest(body), { DB: db })
      expect(res.status, `body=${JSON.stringify(body)}`).toBe(400)
    }
  })
})
