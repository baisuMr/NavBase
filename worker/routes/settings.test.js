// 站点设置 API 单测：mock D1 验证 GET/PUT 行为、键白名单与载荷校验
import { describe, it, expect } from 'vitest'
import { handle } from './settings.js'
import { validateSettingsPayload } from '../utils/validate.js'

// 构造带内存 KV 表的 mock env（模拟 settings 表的 upsert 语义）
function makeFixture(body, method = 'PUT') {
  const rows = []
  const hasBody = body !== undefined
  const env = {
    DB: {
      prepare() {
        return {
          all: async () => ({ results: rows.map(r => ({ key: r[0], value: r[1] })) }),
          bind: (...args) => ({
            run: async () => {
              const idx = rows.findIndex(r => r[0] === args[0])
              if (idx >= 0) rows[idx] = args
              else rows.push(args)
              return { success: true }
            }
          })
        }
      }
    }
  }
  const request = new Request('http://localhost/api/settings', {
    method,
    ...(hasBody
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {})
  })
  return { request, env, rows }
}

async function readJson(res) {
  return { status: res.status, data: await res.json() }
}

describe('validateSettingsPayload', () => {
  it('非对象请求体返回错误', () => {
    expect(validateSettingsPayload(null)).toBeTruthy()
    expect(validateSettingsPayload([1])).toBeTruthy()
    expect(validateSettingsPayload('x')).toBeTruthy()
  })

  it('site_name 允许缺省/空串/正常值，拒绝空白与超长', () => {
    expect(validateSettingsPayload({})).toBeNull()
    expect(validateSettingsPayload({ site_name: '' })).toBeNull()
    expect(validateSettingsPayload({ site_name: '栞记' })).toBeNull()
    expect(validateSettingsPayload({ site_name: '   ' })).toBeTruthy()
    expect(validateSettingsPayload({ site_name: 'a'.repeat(31) })).toBeTruthy()
    expect(validateSettingsPayload({ site_name: 123 })).toBeTruthy()
  })

  it('avatar 允许缺省/空串/png/jpeg/webp，拒绝其他类型与超长', () => {
    expect(validateSettingsPayload({ avatar: '' })).toBeNull()
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const jpg = 'data:image/jpeg;base64,/9j/4AAQ'
    const webp = 'data:image/webp;base64,UklGRh4A'
    expect(validateSettingsPayload({ avatar: png })).toBeNull()
    expect(validateSettingsPayload({ avatar: jpg })).toBeNull()
    expect(validateSettingsPayload({ avatar: webp })).toBeNull()
    expect(validateSettingsPayload({ avatar: 'data:text/html;base64,PGI+' })).toBeTruthy()
    expect(validateSettingsPayload({ avatar: 'data:image/gif;base64,R0lGOD' })).toBeTruthy()
    expect(validateSettingsPayload({ avatar: 'https://x.com/a.png' })).toBeTruthy()
    expect(validateSettingsPayload({ avatar: 12345 })).toBeTruthy()
    expect(validateSettingsPayload({ avatar: 'data:image/png;base64,' + 'A'.repeat(200 * 1024) })).toBeTruthy()
  })
})

describe('GET /api/settings', () => {
  it('空库返回默认空值', async () => {
    const { request, env } = makeFixture(undefined, 'GET')
    const { status, data } = await readJson(await handle(request, env))
    expect(status).toBe(200)
    expect(data).toEqual({ site_name: '', avatar: '' })
  })
})

describe('PUT /api/settings', () => {
  it('写入 site_name 并返回最新值', async () => {
    const { request, env } = makeFixture({ site_name: '栞记' })
    const { status, data } = await readJson(await handle(request, env))
    expect(status).toBe(200)
    expect(data.site_name).toBe('栞记')
  })

  it('部分更新不覆盖未提供的键', async () => {
    const first = makeFixture({ site_name: '栞记' })
    await handle(first.request, first.env)
    const second = makeFixture({ avatar: 'data:image/png;base64,iVBORw0KGgo=' })
    second.rows.push(...first.rows) // 复用同一份数据
    const { data } = await readJson(await handle(second.request, second.env))
    expect(data.site_name).toBe('栞记')
    expect(data.avatar).toContain('data:image/png')
  })

  it('非法载荷返回 400 且不落库', async () => {
    const { request, env, rows } = makeFixture({ site_name: '   ' })
    const { status } = await readJson(await handle(request, env))
    expect(status).toBe(400)
    expect(rows).toHaveLength(0)
  })

  it('白名单外的键被忽略', async () => {
    const { request, env, rows } = makeFixture({ admin: true, site_name: '栞记' })
    const { status } = await readJson(await handle(request, env))
    expect(status).toBe(200)
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe('site_name')
  })

  it('空字符串表示清除为默认', async () => {
    const first = makeFixture({ site_name: '临时名' })
    await handle(first.request, first.env)
    const second = makeFixture({ site_name: '' })
    second.rows.push(...first.rows)
    const { data } = await readJson(await handle(second.request, second.env))
    expect(data.site_name).toBe('')
  })

  it('不支持的方法返回 405', async () => {
    const { request, env } = makeFixture(undefined, 'DELETE')
    const { status } = await readJson(await handle(request, env))
    expect(status).toBe(405)
  })
})
