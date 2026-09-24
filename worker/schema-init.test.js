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
    expect(db.calls.some(c => c.method === 'run' && c.sql.includes('CREATE TABLE IF NOT EXISTS bookmarks'))).toBe(true)
    expect(db.calls.some(c => c.method === 'run' && c.sql.startsWith('INSERT INTO categories'))).toBe(true)
  })

  it('三张关键表齐全时跳过初始化', async () => {
    const ensureSchema = await load()
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('sqlite_master')) return { cnt: 3 }
    })
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'run')).toBe(false)
  })

  it('部分表缺失（旧库）也会执行幂等 schema 补齐', async () => {
    const ensureSchema = await load()
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('sqlite_master')) return { cnt: 2 }
    })
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'run')).toBe(true)
  })

  it('初始化失败后可重试（缓存被清除）', async () => {
    const ensureSchema = await load()
    let fail = true
    const db = createMockDB(({ method }) => {
      if (method === 'run' && fail) { fail = false; throw new Error('boom') }
    })
    await expect(ensureSchema({ DB: db })).rejects.toThrow('boom')
    await expect(ensureSchema({ DB: db })).resolves.toBeUndefined()
    // 首次 batch 在首条语句（categories 建表）即抛错中断；重试完整执行，共 2 次
    expect(db.calls.filter(c => c.method === 'run' && c.sql.includes('CREATE TABLE IF NOT EXISTS categories')).length).toBe(2)
  })

  it('同一 DB 二次调用复用缓存，只探测执行一次', async () => {
    const ensureSchema = await load()
    const db = createMockDB()
    await ensureSchema({ DB: db })
    await ensureSchema({ DB: db })
    expect(db.calls.filter(c => c.method === 'first')).toHaveLength(1)
    expect(db.calls.filter(c => c.method === 'run' && c.sql.includes('CREATE TABLE IF NOT EXISTS categories')).length).toBe(1)
  })

  it('执行的 SQL 已剥离整行注释（D1 不接受纯注释段）', async () => {
    const ensureSchema = await load()
    const db = createMockDB()
    await ensureSchema({ DB: db })
    const executed = db.calls.filter(c => c.method === 'run').map(c => c.sql).join('\n')
    expect(executed).not.toMatch(/(^|\n)\s*--/)
    expect(executed).toContain('CREATE TABLE IF NOT EXISTS bookmarks')
  })
})
