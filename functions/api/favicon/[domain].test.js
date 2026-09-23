import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onRequest } from './[domain].js'

// 模拟 Cloudflare Cache API（node 环境没有 caches 全局，函数在调用期才访问它）
const cacheStore = new Map()
function stubCaches() {
  vi.stubGlobal('caches', {
    default: {
      match: async req => cacheStore.get(req.url) || null,
      put: async (req, res) => { cacheStore.set(req.url, res) }
    }
  })
}

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

function htmlResponse(html) {
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}

function imageResponse(bytes, contentType = 'image/png') {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': contentType }
  })
}

function redirectResponse(location, status = 301) {
  return new Response(null, { status, headers: { Location: location } })
}

// 按 URL 前缀匹配返回预设响应（最长前缀优先，避免 / 前缀吞掉 /favicon.ico），
// 未命中的源视为连接失败；记录每次调用的 url 与 options
function stubFetch(byUrl) {
  const calls = []
  const entries = Object.entries(byUrl).sort((a, b) => b[0].length - a[0].length)
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    calls.push({ url, options })
    const hit = entries.find(([prefix]) => url.startsWith(prefix))
    if (!hit) throw new Error('ECONNREFUSED')
    const value = typeof hit[1] === 'function' ? await hit[1]() : hit[1]
    return value
  }))
  return calls
}

beforeEach(() => {
  cacheStore.clear()
  vi.unstubAllGlobals()
  stubCaches()
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

  it('HTML 无图标声明时降级 favicon.ico 成功并带缓存头', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html><head></head><body></body></html>'),
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

  it('从首页 HTML 解析 <link rel="icon"> 并请求声明的图标', async () => {
    const calls = stubFetch({
      'https://example.com/': htmlResponse('<html><head><link rel="icon" href="/icon.png" sizes="32x32"></head></html>'),
      'https://example.com/icon.png': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://example.com/icon.png')
    expect(calls.some(c => c.url === 'https://example.com/icon.png')).toBe(true)
  })

  it('apple-touch-icon 优先于普通 icon（尺寸更大）', async () => {
    const calls = stubFetch({
      'https://example.com/': htmlResponse(
        '<html><head>' +
        '<link rel="icon" href="/icon-32.png" sizes="32x32">' +
        '<link rel="apple-touch-icon" href="/apple-180.png" sizes="180x180">' +
        '</head></html>'
      ),
      'https://example.com/apple-180.png': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://example.com/apple-180.png')
    expect(calls.some(c => c.url === 'https://example.com/icon-32.png')).toBe(false)
  })

  it('上游返回错误页（非图片）时跳过该源取下一源', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
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
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(PNG_HEAD, '')
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/x-icon')
  })

  it('超过大小上限的响应被拒绝', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(new Array(600 * 1024).fill(0x41))
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(404)
  })

  it('首页 HTML 只读取前 256KB，超大页面不整页读入', async () => {
    // 流式 body 统计实际读出的字节数；图标声明在 head 区（前 256KB 内）
    const full = new TextEncoder().encode(
      '<html><head><link rel="icon" href="/icon.png" sizes="32x32"></head>' + 'x'.repeat(600 * 1024)
    )
    let sent = 0
    const stream = new ReadableStream({
      pull(controller) {
        if (sent >= full.length) {
          controller.close()
          return
        }
        const end = Math.min(sent + 64 * 1024, full.length)
        controller.enqueue(full.slice(sent, end))
        sent = end
      }
    })
    stubFetch({
      'https://example.com/': () => new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      'https://example.com/icon.png': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://example.com/icon.png')
    // 截断读取：实际读出的字节数 ≤ 256KB + 预取余量（至多 2 个 64KB chunk），远小于整页 600KB+
    expect(sent).toBeLessThan(400 * 1024)
  })

  it('301 重定向被手动跟随（如 http→https 或路径迁移）', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': redirectResponse('/assets/favicon.ico'),
      'https://example.com/assets/favicon.ico': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://example.com/favicon.ico')
  })

  it('重定向到非 http(s) 协议时该源失败', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': redirectResponse('javascript:alert(1)'),
      'https://favicon.im/example.com': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://favicon.im/example.com')
  })

  it('重定向到非法域名（IP 直连）时该源失败，不跟随跳转', async () => {
    const calls = stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': redirectResponse('http://127.0.0.1/icon.png'),
      // 恶意目标若被跟随会返回合法图片（当前缺陷行为会接受它）
      'http://127.0.0.1/icon.png': imageResponse(PNG_HEAD),
      'https://favicon.im/example.com': imageResponse(PNG_HEAD)
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://favicon.im/example.com')
    // 核心断言：绝不向非法跳转目标发起请求
    expect(calls.some(c => c.url === 'http://127.0.0.1/icon.png')).toBe(false)
  })

  it('首个成功源会取消其余在途探测请求', async () => {
    // favicon.im 返回挂起的 promise（模拟慢源），HTML 源成功后其余源应被 abort
    const calls = stubFetch({
      'https://example.com/': htmlResponse('<html><head><link rel="icon" href="/icon.png"></head></html>'),
      'https://example.com/icon.png': imageResponse(PNG_HEAD),
      'https://favicon.im/example.com': () => new Promise(() => {})
    })
    const res = await onRequest(makeContext('example.com'))
    expect(res.status).toBe(200)
    // 等 abort 信号传播
    await new Promise(r => setTimeout(r, 0))
    const imCall = calls.find(c => c.url.startsWith('https://favicon.im/'))
    expect(imCall).toBeTruthy()
    expect(imCall.options.signal.aborted).toBe(true)
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
