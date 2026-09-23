// 仅供测试：轻量 D1 mock，记录 SQL/bind 并按 handler 路由返回值
// handler({ sql, args, method }) 返回 undefined 时使用默认值
export function createMockDB(handler = () => undefined) {
  const calls = []

  const makeStmt = (sql, args) => ({
    async run() {
      calls.push({ sql, args, method: 'run' })
      return handler({ sql, args, method: 'run' }) ?? { meta: { last_row_id: 1 } }
    },
    async first() {
      calls.push({ sql, args, method: 'first' })
      return handler({ sql, args, method: 'first' }) ?? null
    },
    async all() {
      calls.push({ sql, args, method: 'all' })
      return handler({ sql, args, method: 'all' }) ?? { results: [] }
    }
  })

  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return makeStmt(sql, args)
        },
        ...makeStmt(sql, [])
      }
    },
    async batch(stmts) {
      const out = []
      for (const s of stmts) out.push(await s.run())
      return out
    }
  }
}
