// PUT /api/categories/sort 分类重排：按传入 id 顺序重编 sort_order（1..n）
// 与新建/编辑的排序行为（categories.sort.test.js）互不干扰：编辑仍不改 sort_order
import { describe, it, expect, vi } from 'vitest'
import { sort } from './categories.js'
import { createMockDB } from '../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

function sortRequest(body) {
  return new Request('http://test/api/categories/sort', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(body)
  })
}

// 库内现有分类 id 集合
function mockDBWithIds(ids = [1, 2, 3]) {
  return createMockDB(({ sql, method }) => {
    if (method === 'all' && sql.includes('SELECT id FROM categories')) {
      return { results: ids.map((id) => ({ id })) }
    }
  })
}

describe('分类重排 PUT /api/categories/sort', () => {
  it('按 ids 顺序批量重编 sort_order（1..n）', async () => {
    const db = mockDBWithIds()
    const res = await sort(sortRequest({ ids: [3, 1, 2] }), { DB: db })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    const updates = db.calls.filter((c) => c.method === 'run' && c.sql.includes('UPDATE categories'))
    expect(updates.length).toBe(3)
    // SET sort_order = ? WHERE id = ? → args 为 [sort_order, id]
    expect(updates.map((c) => c.args)).toEqual([
      [1, 3],
      [2, 1],
      [3, 2]
    ])
  })

  it('重排经由 D1 batch 事务执行', async () => {
    const db = mockDBWithIds()
    const spy = vi.spyOn(db, 'batch')
    await sort(sortRequest({ ids: [3, 1, 2] }), { DB: db })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].length).toBe(3)
  })

  it('ids 与库内集合不一致返回 400', async () => {
    for (const ids of [[1, 2], [1, 2, 3, 4], [1, 2, 4]]) {
      const db = mockDBWithIds()
      const res = await sort(sortRequest({ ids }), { DB: db })
      expect(res.status, `ids=${JSON.stringify(ids)}`).toBe(400)
    }
  })

  it('重复 id 返回 400', async () => {
    const db = mockDBWithIds()
    const res = await sort(sortRequest({ ids: [1, 2, 2] }), { DB: db })
    expect(res.status).toBe(400)
  })

  it('非法 ids 形态返回 400', async () => {
    const bodies = [{}, { ids: null }, { ids: 'x' }, { ids: [] }, { ids: [0] }, { ids: [1.5] }, { ids: ['1'] }, { ids: [1, null] }]
    for (const body of bodies) {
      const db = mockDBWithIds()
      const res = await sort(sortRequest(body), { DB: db })
      expect(res.status, `body=${JSON.stringify(body)}`).toBe(400)
    }
  })
})
