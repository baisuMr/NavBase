// 分类排序行为：新建排最后（sort_order = MAX+1），编辑不改排序
import { describe, it, expect } from 'vitest'
import { collection, item } from './categories.js'
import { createMockDB } from '../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

describe('分类排序', () => {
  it('创建分类的 sort_order 取 MAX+1（新分类排最后），不接受传入值', async () => {
    const db = createMockDB()
    const res = await collection(new Request('http://test/api/categories', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: '新分类', icon: 'ri-folder-line', color: '#10b981', sort_order: 0 })
    }), { DB: db })
    expect(res.status).toBe(201)
    const insert = db.calls.find(c => c.sql.includes('INSERT INTO categories'))
    expect(insert.sql).toMatch(/COALESCE\(MAX\(sort_order\),\s*0\)\s*\+\s*1/i)
    // sort_order 不走 bind：仅 name/icon/color 三个参数
    expect(insert.args.length).toBe(3)
  })

  it('更新分类不改动 sort_order（保留原排序）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM categories')) return { id: 1 }
    })
    const res = await item(new Request('http://test/api/categories/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ name: '改名', icon: 'ri-folder-line', color: '#10b981', sort_order: 99 })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(200)
    const update = db.calls.find(c => c.sql.includes('UPDATE categories'))
    expect(update.sql).not.toMatch(/sort_order/)
    expect(update.args).not.toContain(99)
  })
})
