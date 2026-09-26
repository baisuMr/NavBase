// Basic Auth 认证门单测：重点回归路径归一化后的认证绕过防护
// （原 Pages _middleware.test.js，按 authGate 契约改造：返回 null 表示放行）
import { describe, it, expect, vi, afterEach } from 'vitest'
import { authGate } from './auth.js'

const SECRET = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 's3cret' }
const basic = (u, p) => 'Basic ' + btoa(`${u}:${p}`)

// 假时钟用例兜底还原，防止泄漏到其它用例
afterEach(() => vi.useRealTimers())

function makeRequest(path, headers = {}) {
  return new Request(`https://example.com${path}`, { headers })
}
const run = (path, headers = {}, env = SECRET) => authGate(makeRequest(path, headers), env)

// 认证失败用例统一走假时钟：发起请求 → 等防爆破定时器挂上假时钟 → 推进 801ms 触发 → 等响应，
// 免去真实 800ms 等待。secureCompare 的 crypto.subtle.digest 需若干真实事件循环轮次才完成，
// 定时器挂上前不能推时钟，否则 800ms 延迟会被排到更晚、响应永远等不到
async function runWithFakeDelay(fn) {
  vi.useFakeTimers()
  try {
    const p = fn()
    // secureCompare 的 crypto.subtle.digest 需若干真实事件循环轮次，全量并行下 CPU 满载时
    // 轮次需求会膨胀，故放宽空转上限；极端情况下退回真实时钟，避免 await p 挂到超时
    for (let i = 0; i < 500 && vi.getTimerCount() === 0; i++) {
      await vi.advanceTimersByTimeAsync(0)
    }
    if (vi.getTimerCount() > 0) {
      await vi.advanceTimersByTimeAsync(801)
    } else {
      // 定时器迟迟未挂上：退回真实时钟让 800ms 延迟真实走完（慢但不 flake）
      vi.useRealTimers()
    }
    return await p
  } finally {
    vi.useRealTimers()
  }
}

describe('认证正常路径', () => {
  it('带正确凭据访问 API 放行（返回 null）', async () => {
    const res = await run('/api/bookmarks', { Authorization: basic('admin', 's3cret') })
    expect(res).toBeNull()
  })

  it('无凭据访问 API 返回 401', async () => {
    const res = await runWithFakeDelay(() => run('/api/bookmarks'))
    expect(res.status).toBe(401)
  })

  it('错误凭据返回 401', async () => {
    const res = await runWithFakeDelay(() =>
      run('/api/bookmarks', { Authorization: basic('admin', 'wrong') })
    )
    expect(res.status).toBe(401)
  })

  it('非 Basic 方案返回 401', async () => {
    const res = await runWithFakeDelay(() =>
      run('/api/bookmarks', { Authorization: 'Bearer xyz' })
    )
    expect(res.status).toBe(401)
  })

  it('非法 base64 返回 401 而非崩溃', async () => {
    const res = await runWithFakeDelay(() =>
      run('/api/bookmarks', { Authorization: 'Basic !!!bad' })
    )
    expect(res.status).toBe(401)
  })

  it('未配置密码时 fail-closed 返回 500', async () => {
    const res = await run('/api/bookmarks', { Authorization: basic('admin', 'x') }, {})
    expect(res.status).toBe(500)
  })

  it('OPTIONS 预检直接放行', async () => {
    const res = await authGate(
      new Request('https://example.com/api/bookmarks', { method: 'OPTIONS' }),
      SECRET
    )
    expect(res).toBeNull()
  })

  it('登录接口精确豁免认证', async () => {
    expect(await run('/api/auth/login')).toBeNull()
  })

  it('登录接口尾斜杠不豁免', async () => {
    const res = await runWithFakeDelay(() => run('/api/auth/login/'))
    expect(res.status).toBe(401)
  })
})

describe('路径归一化防绕过（历史 P0 回归）', () => {
  const cases = [
    ['/API/bookmarks', '大写'],
    ['/Api/Bookmarks', '混合大小写'],
    ['//api/bookmarks', '双斜杠'],
    ['/api%2Fbookmarks', '编码斜杠大写'],
    ['/api%2fbookmarks', '编码斜杠小写'],
    ['/api/auth/login/', '登录尾斜杠']
  ]
  for (const [path, label] of cases) {
    it(`${label}变体 ${path} 返回 401 而非放行`, async () => {
      const res = await runWithFakeDelay(() => run(path))
      expect(res.status).toBe(401)
    })
  }

  it('静态资源路径正常放行', async () => {
    for (const path of ['/', '/login', '/assets/index.js', '/favicon.ico', '/schema.sql']) {
      expect(await run(path), path).toBeNull()
    }
  })
})

describe('防爆破延迟', () => {
  it('认证失败响应延迟约 800ms（防爆破）', async () => {
    vi.useFakeTimers()
    try {
      const req = new Request('http://test/api/bookmarks', { headers: { Authorization: 'Basic ' + btoa('u:p') } })
      const p = authGate(req, { ADMIN_PASSWORD: 'x' })
      // 等 secureCompare 的 digest 完成、防爆破定时器挂上假时钟（只空转真实轮次，不移动时钟）；
      // 全量并行下 CPU 满载时轮次需求膨胀，故放宽上限
      for (let i = 0; i < 500 && vi.getTimerCount() === 0; i++) {
        await vi.advanceTimersByTimeAsync(0)
      }
      expect(vi.getTimerCount()).toBeGreaterThan(0) // 定时器未挂上时明确失败，避免 await p 挂死
      await vi.advanceTimersByTimeAsync(799)
      let settled = false
      p.then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(false) // 799ms 时还没返回
      await vi.advanceTimersByTimeAsync(1)
      const res = await p
      expect(res.status).toBe(401)
    } finally {
      vi.useRealTimers()
    }
  })
})
