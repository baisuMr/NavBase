// DELETE /api/categories/:id 删除分类：置空书签 + 删分类须经 D1 batch 原子执行
import { describe, it, expect, vi } from 'vitest'
import { onRequest } from './[id].js'
import { createMockDB } from '../../utils/mock-d1.js'

function mockDBWithCategory() {
  return createMockDB(({ sql, method }) => {
    if (method === 'first' && sql.includes('SELECT id FROM categories')) {
      return { id: 1 }
    }
  })
}

describe('删除分类 DELETE /api/categories/:id', () => {
  it('置空书签与删除分类经 D1 batch 事务执行（两条语句原子提交）', async () => {
    const db = mockDBWithCategory()
    const spy = vi.spyOn(db, 'batch')
    const res = await onRequest({
      request: new Request('http://test/api/categories/1', { method: 'DELETE' }),
      env: { DB: db },
      params: { id: '1' }
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].length).toBe(2)
  })
})
