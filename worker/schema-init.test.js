// schema 自动初始化：空库建表 / 已建库跳过 / 失败可重试 / 同 isolate 只探测一次
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDB } from './utils/mock-d1.js'

// 模块级缓存跨用例污染，每个用例重置模块取全新实例
beforeEach(() => vi.resetModules())

const load = () => import('./schema-init.js').then(m => m.ensureSchema)

describe('ensureSchema', () => {
  it('空库（表缺失）时幂等执行全量 schema.sql', async () => {
    const ensureSchema = await load()
    const db = createMockDB() // 默认 first() 返回 null → 视为表缺失
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'first' && c.sql.includes('sqlite_master'))).toBe(true)
    expect(db.calls.filter(c => c.method === 'exec')).toHaveLength(1)
    const execSql = db.calls.find(c => c.method === 'exec').sql
    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS bookmarks')
    expect(execSql).toContain("INSERT INTO categories")
  })

  it('三张关键表齐全时跳过初始化', async () => {
    const ensureSchema = await load()
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('sqlite_master')) return { cnt: 3 }
    })
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'exec')).toBe(false)
  })

  it('部分表缺失（旧库）也会执行幂等 schema 补齐', async () => {
    const ensureSchema = await load()
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('sqlite_master')) return { cnt: 2 }
    })
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'exec')).toBe(true)
  })

  it('初始化失败后可重试（缓存被清除）', async () => {
    const ensureSchema = await load()
    let fail = true
    const db = createMockDB(({ method }) => {
      if (method === 'exec' && fail) { fail = false; throw new Error('boom') }
    })
    await expect(ensureSchema({ DB: db })).rejects.toThrow('boom')
    await expect(ensureSchema({ DB: db })).resolves.toBeUndefined()
    expect(db.calls.filter(c => c.method === 'exec')).toHaveLength(2)
  })

  it('同一 DB 二次调用复用缓存，只探测一次', async () => {
    const ensureSchema = await load()
    const db = createMockDB()
    await ensureSchema({ DB: db })
    await ensureSchema({ DB: db })
    expect(db.calls.filter(c => c.method === 'first')).toHaveLength(1)
    expect(db.calls.filter(c => c.method === 'exec')).toHaveLength(1)
  })

  it('传给 exec 的 SQL 已剥离整行注释（D1 exec 不接受纯注释段）', async () => {
    const ensureSchema = await load()
    const db = createMockDB()
    await ensureSchema({ DB: db })
    const execSql = db.calls.find(c => c.method === 'exec').sql
    expect(execSql).not.toMatch(/(^|\n)\s*--/)
    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS bookmarks')
  })
})
