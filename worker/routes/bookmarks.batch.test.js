// 批量导入校验逻辑单测：协议白名单与字段类型、去重下推唯一索引语义
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateBookmarkPayload } from '../utils/validate.js'
import { batch, collection, item } from './bookmarks.js'
import { createMockDB } from '../utils/mock-d1.js'
import schemaSql from '../../schema.sql'

const jsonHeaders = { 'Content-Type': 'application/json' }

const postBatch = (db, bookmarks) => batch(new Request('http://test/api/bookmarks/batch', {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({ bookmarks })
}), { DB: db })

describe('validateBookmark 协议白名单', () => {
  const blocked = [
    ['javascript:alert(1)', 'js 协议'],
    ['JaVaScRiPt:alert(1)', '大小写混合 js 协议'],
    ['data:text/html,<b>x</b>', 'data 协议'],
    ['vbscript:x', 'vbscript 协议'],
    ['file:///c:/windows', 'file 协议'],
    [' javascript:alert(1)', '前导空格 js 协议'],
    ['java\nscript:alert(1)', '换行拆分 js 协议'],
    ['//evil.com', '协议相对地址'],
    ['http://', '空主机名'],
    ['ftp://files.example.com', 'ftp 协议']
  ]
  for (const [url, label] of blocked) {
    it(`拦截 ${label}`, () => {
      expect(validateBookmarkPayload({ title: 't', url })).toMatch(/仅支持|格式不正确/)
    })
  }

  const allowed = [
    ['https://example.com', 'https'],
    ['http://example.com', 'http'],
    ['https://example.com/a?b=1#c', '带查询与锚点']
  ]
  for (const [url, label] of allowed) {
    it(`放行 ${label}`, () => {
      expect(validateBookmarkPayload({ title: 't', url })).toBeNull()
    })
  }
})

describe('validateBookmark 字段校验', () => {
  it('缺失字段返回错误', () => {
    expect(validateBookmarkPayload(null)).toBeTruthy()
    expect(validateBookmarkPayload({})).toBeTruthy()
    expect(validateBookmarkPayload({ title: 't' })).toBeTruthy()
    expect(validateBookmarkPayload({ url: 'https://a.com' })).toBeTruthy()
  })

  it('纯空白标题被拒绝', () => {
    expect(validateBookmarkPayload({ title: '   ', url: 'https://a.com' })).toBeTruthy()
  })

  it('非字符串标题被拒绝', () => {
    expect(validateBookmarkPayload({ title: 123, url: 'https://a.com' })).toBeTruthy()
  })

  it('非法类型 category_id / sort_order 返回错误而非 500', () => {
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', category_id: 'abc' })).toMatch(/分类ID/)
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', sort_order: { a: 1 } })).toMatch(/排序/)
  })

  it('合法类型通过', () => {
    expect(validateBookmarkPayload({
      title: 't',
      url: 'https://a.com',
      description: 'd',
      category_id: 3,
      sort_order: 0,
      icon_url: ''
    })).toBeNull()
  })
})

describe('导入去重下推唯一索引', () => {
  it('batch 插入语句使用 INSERT OR IGNORE（撞唯一索引的重复行静默跳过）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('WHERE url IN')) return { results: [] }
      if (method === 'first' && sql.includes('MAX(sort_order)')) return { max: 0 }
    })
    const res = await postBatch(db, [
      { title: 'a', url: 'https://a.com' },
      { title: 'b', url: 'https://b.com' }
    ])
    expect(res.status).toBe(200)
    const inserts = db.calls.filter(c => c.sql.includes('INTO bookmarks'))
    expect(inserts.length).toBe(2)
    for (const ins of inserts) expect(ins.sql).toMatch(/^INSERT OR IGNORE INTO bookmarks/)
    expect(await res.json()).toEqual({ success: true, count: 2, skipped: 0 })
  })

  it('被唯一索引忽略的行不计 count、计入 skipped（并发竞态兜底）', async () => {
    let seq = 0
    const db = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('WHERE url IN')) return { results: [] }
      if (method === 'first' && sql.includes('MAX(sort_order)')) return { max: 0 }
      if (method === 'run' && sql.includes('INSERT')) {
        seq += 1
        // 第 2 条在查库后被并发抢先写入，撞唯一索引被 OR IGNORE 忽略（changes 为 0）
        return { meta: { last_row_id: seq, changes: seq === 2 ? 0 : 1 } }
      }
    })
    const res = await postBatch(db, [
      { title: 'a', url: 'https://a.com' },
      { title: 'b', url: 'https://b.com' },
      { title: 'c', url: 'https://c.com' }
    ])
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, count: 2, skipped: 1 })
  })

  it('库内已存在与批内重复仍在插入前过滤（预检查保留，不浪费写入）', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'all' && sql.includes('WHERE url IN')) return { results: [{ url: 'https://dup.com' }] }
      if (method === 'first' && sql.includes('MAX(sort_order)')) return { max: 0 }
    })
    const res = await postBatch(db, [
      { title: 'x', url: 'https://dup.com' },
      { title: 'x2', url: 'https://dup.com' },
      { title: 'y', url: 'https://new.com' }
    ])
    expect(res.status).toBe(200)
    expect(db.calls.filter(c => c.sql.includes('INTO bookmarks')).length).toBe(1)
    expect(await res.json()).toEqual({ success: true, count: 1, skipped: 2 })
  })

  it('schema.sql 的 url 索引为唯一索引（新库建表即带约束）', () => {
    expect(schemaSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);')
  })

  it('迁移先清重再建唯一索引（存量库可重复执行）', () => {
    // 迁移文件在实现阶段创建，此处缺失即红
    const migrationSql = readFileSync(
      new URL('../../migrations/2026-09-26-unique-bookmark-url.sql', import.meta.url),
      'utf8'
    )
    expect(migrationSql).toMatch(
      /DELETE FROM bookmarks WHERE id NOT IN \(SELECT MIN\(id\) FROM bookmarks GROUP BY url\)/
    )
    expect(migrationSql).toContain('DROP INDEX IF EXISTS idx_bookmarks_url')
    expect(migrationSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)')
  })

  it('单条创建撞重复 url 返回 400 而非 500', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'run' && sql.includes('INSERT INTO bookmarks')) {
        throw new Error('D1_ERROR: UNIQUE constraint failed: bookmarks.url')
      }
    })
    const res = await collection(new Request('http://test/api/bookmarks', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://a.com' })
    }), { DB: db })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.error).toContain('已存在')
  })

  it('编辑把 url 改成已存在的链接返回 400 而非 500', async () => {
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('SELECT id FROM bookmarks')) return { id: 1 }
      if (method === 'run' && sql.includes('UPDATE bookmarks')) {
        throw new Error('D1_ERROR: UNIQUE constraint failed: bookmarks.url')
      }
    })
    const res = await item(new Request('http://test/api/bookmarks/1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ title: 't', url: 'https://dup.com' })
    }), { DB: db }, { id: '1' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.error).toContain('已存在')
  })
})
