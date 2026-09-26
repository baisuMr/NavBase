// POST /api/bookmarks/batch 端点行为测试：去重计数、上限、错误结构与折叠守卫
// （category_id 存在性校验、畸形 JSON 体分类——随测试补实现）
import { describe, it, expect } from 'vitest'
import { batch } from './bookmarks.js'
import { createMockDB } from '../utils/mock-d1.js'

const jsonHeaders = { 'Content-Type': 'application/json' }

// raw 时 body 原样透传（用于畸形 JSON 场景）
const makeReq = (body, { raw = false } = {}) => new Request('http://test/api/bookmarks/batch', {
  method: 'POST',
  headers: jsonHeaders,
  body: raw ? body : JSON.stringify(body)
})

// 常规 mock：库内无重复命中、MAX(sort_order) 为 0；categories 查询缺省返回 null（不存在）
const baseMock = ({ sql, method }) => {
  if (method === 'all' && sql.includes('WHERE url IN')) return { results: [] }
  if (method === 'first' && sql.includes('MAX(sort_order)')) return { max: 0 }
}

describe('批量导入端点行为', () => {
  it('批内重复 url 只保留首条并计入 skipped', async () => {
    const db = createMockDB(baseMock)
    const res = await batch(makeReq({
      bookmarks: [
        { title: 'a', url: 'https://dup.com' },
        { title: 'b', url: 'https://dup.com' }
      ]
    }), { DB: db })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, count: 1, skipped: 1 })
    // 批内去重在插入前完成：重复条目不产生写入
    expect(db.calls.filter(c => c.sql.includes('INTO bookmarks')).length).toBe(1)
  })

  it('库内已存在的 url 跳过并计入 skipped', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('WHERE url IN')) return { results: [{ url: 'https://old.com' }] }
      if (method === 'first' && sql.includes('MAX(sort_order)')) return { max: 0 }
    })
    const res = await batch(makeReq({
      bookmarks: [
        { title: 'old', url: 'https://old.com' },
        { title: 'fresh', url: 'https://fresh.com' }
      ]
    }), { DB: db })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, count: 1, skipped: 1 })
    // 库内已存在的 url 不触发插入
    const inserts = db.calls.filter(c => c.sql.includes('INTO bookmarks'))
    expect(inserts.length).toBe(1)
    expect(inserts[0].args).toContain('https://fresh.com')
  })

  it('超过 500 条返回 400 且文案含上限数字', async () => {
    const db = createMockDB(baseMock)
    const bookmarks = Array.from({ length: 501 }, (_, i) => ({ title: `t${i}`, url: `https://a.com/${i}` }))
    const res = await batch(makeReq({ bookmarks }), { DB: db })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.error).toContain('500')
    // 超限时不得写库
    expect(db.calls.some(c => c.sql.includes('INTO bookmarks'))).toBe(false)
  })

  it('成功响应结构为 { success, count, skipped }', async () => {
    const db = createMockDB(baseMock)
    const res = await batch(makeReq({
      bookmarks: [
        { title: 'a', url: 'https://a.com' },
        { title: 'b', url: 'https://b.com' }
      ]
    }), { DB: db })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['count', 'skipped', 'success'])
    expect(body).toEqual({ success: true, count: 2, skipped: 0 })
  })

  it('无效项返回 400 且错误消息带上该条 url', async () => {
    const db = createMockDB(baseMock)
    const badUrl = 'javascript:alert(1)'
    const res = await batch(makeReq({
      bookmarks: [
        { title: 'ok', url: 'https://ok.com' },
        { title: 'bad', url: badUrl }
      ]
    }), { DB: db })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.error).toContain(badUrl)
    // 校验失败整体拒绝，不写库
    expect(db.calls.some(c => c.sql.includes('INTO bookmarks'))).toBe(false)
  })
})

describe('折叠守卫：category_id 存在性', () => {
  it('导入项携带不存在的分类返回 400 CATEGORY_NOT_FOUND，存在时放行', async () => {
    // 缺省 handler 下 categories 查询返回 null → 分类不存在
    const redDb = createMockDB(baseMock)
    const redRes = await batch(makeReq({
      bookmarks: [{ title: 'a', url: 'https://a.com', category_id: 999 }]
    }), { DB: redDb })
    expect(redRes.status).toBe(400)
    expect(await redRes.json()).toEqual({ error: '分类不存在', code: 'CATEGORY_NOT_FOUND' })
    // 拦截发生在插入前
    expect(redDb.calls.some(c => c.sql.includes('INTO bookmarks'))).toBe(false)

    // 分类存在时正常导入（防止过度拦截）；分类校验为一条 id IN 查询（all()）
    const okDb = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('FROM categories')) return { results: [{ id: 999 }] }
      return baseMock({ sql, method })
    })
    const okRes = await batch(makeReq({
      bookmarks: [{ title: 'a', url: 'https://a.com', category_id: 999 }]
    }), { DB: okDb })
    expect(okRes.status).toBe(200)
    expect(await okRes.json()).toEqual({ success: true, count: 1, skipped: 0 })
  })
})

describe('折叠守卫：畸形 JSON 请求体', () => {
  it('非法 JSON 请求体返回 400 请求体格式不正确（不落 500）', async () => {
    const db = createMockDB(baseMock)
    const res = await batch(makeReq('not-json', { raw: true }), { DB: db })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '请求体格式不正确', code: 'VALIDATION_ERROR' })
    expect(db.calls.some(c => c.sql.includes('INTO bookmarks'))).toBe(false)
  })
})
