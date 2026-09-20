import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onRequest } from './[domain].js'

// 模拟 Cloudflare Cache API（node 环境没有 caches 全局，函数在调用期才访问它）
const cacheStore = new Map()
vi.stubGlobal('caches', {
  default: {
    match: async req => cacheStore.get(req.url) || null,
    put: async (req, res) => { cacheStore.set(req.url, res) }
  }
})

// 图片魔数样本（PNG / ICO 文件头）
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ICO_HEAD = [0x00, 0x00, 0x01, 0x00, 0x01, 0x00]

function makeContext(domain, method = 'GET') {
  const waitUntil = []
  return {
    params: { domain },
    request: new Request(`https://site.example/api/favicon/${domain}`, { method }),
    waitUntil: promise => waitUntil.push(promise),
    waitUntilQueue: waitUntil
  }
}

// 按 URL 前缀匹配返回预设响应，未命中的源视为连接失败
function stubFetch(byUrl) {
  vi.stubGlobal('fetch', vi.fn(async url => {
    const hit = Object.entries(byUrl).find(([prefix]) => url.startsWith(prefix))
    if (!hit) throw new Error('ECONNREFUSED')
    return hit[1]
  }))
}

function imageResponse(bytes, contentType = 'image/png') {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': contentType }
  })
}

beforeEach(() => {
  cacheStore.clear()
  vi.unstubAllGlobals()
  // 重新装上 caches 桩（unstubAllGlobals 会把它一并清掉）
  vi.stubGlobal('caches', {
    default: {
      match: async req => cacheStore.get(req.url) || null,
      put: async (req, res) => { cacheStore.set(req.url, res) }
    }
  })
})

describe('GET /api/favicon/:domain', () => {
  it('域名格式不合法返回 400', async () => {
    stubFetch({})
    for (const bad of ['ev il.com', 'localhost', '192.168.1.1', 'evil.com/path', '..']) {
      const res = await onRequest(makeContext(bad))
      expect(res.status, bad).toBe(400)
    }
  })

  it('非 GET 请求返回 405，OPTIONS 直接放行', async () => {
    stubFetch({})
    expect((await onRequest(makeContext('example.com', 'POST'))).status).toBe(405)
    expect((await onRequest(makeContext('example.com', 'OPTIONS'))).status).toBe(200)
  })

  it('全部源失败返回 404，并写入负面缓存', async () => {
    stubFetch({})
    const ctx = makeContext('example.com')
    const res = await onRequest(ctx)
    expect(res.status).toBe(404)
    await Promise.all(ctx.waitUntilQueue)
    const keys = [...cacheStore.keys()]
    expect(keys).toHaveLength(1)
    expect(cacheStore.get(keys[0]).status).toBe(404)
  })

  it('首个成功源返回图片字节并带缓存头', async () => {
    stubFetch({
      'https://example.com/favicon.ico': imageResponse(ICO_HEAD, 'image/x-icon')
    })
    const ctx = makeContext('example.com')
    const res = await onRequest(ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/x-icon')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=604800')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect([...buf.slice(0, 4)]).toEqual(ICO_HEAD.slice(0, 4))
    await Promise.all(ctx.waitUntilQueue)
    expect(cacheStore.size).toBe(1)
  })

  it('上游返回错误页（非图片）时跳过该源取下一源', async () => {
    stubFetch({
      'https://example.com/favicon.ico': new Response('<html>404 page</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }),
      'https://favicon.im/example.com': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://favicon.im/example.com')
  })

  it('content-type 缺失但魔数为图片时仍接受', async () => {
    stubFetch({
      'https://example.com/favicon.ico': imageResponse(PNG_HEAD, '')
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/x-icon')
  })

  it('超过大小上限的响应被拒绝', async () => {
    stubFetch({
      'https://example.com/favicon.ico': imageResponse(new Array(600 * 1024).fill(0x41))
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(404)
  })

  it('缓存命中时不发起上游请求', async () => {
    const cached = imageResponse(PNG_HEAD)
    const key = new Request('https://favicon-cache.local/example.com')
    cacheStore.set(key.url, cached)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
