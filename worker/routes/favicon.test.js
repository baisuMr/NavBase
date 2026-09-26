import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, MAX_ICON_BYTES } from './favicon.js'

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

function makeFixture(domain, method = 'GET') {
  const waitUntil = []
  return {
    request: new Request(`https://site.example/api/favicon/${domain}`, { method }),
    params: { domain },
    ctx: { waitUntil: promise => waitUntil.push(promise) },
    waitUntilQueue: waitUntil
  }
}

const invoke = (f) => handle(f.request, {}, f.params, f.ctx)

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
      const res = await invoke(makeFixture(bad))
      expect(res.status, bad).toBe(400)
    }
  })

  it('非 GET 请求（含 OPTIONS）返回 405 METHOD_NOT_ALLOWED', async () => {
    stubFetch({})
    const post = await invoke(makeFixture('example.com', 'POST'))
    expect(post.status).toBe(405)
    expect(await post.json()).toEqual({ error: '请求方法不支持', code: 'METHOD_NOT_ALLOWED' })
    expect((await invoke(makeFixture('example.com', 'OPTIONS'))).status).toBe(405)
  })

  it('SVG 一律拒收（防直接访问时在站点源下执行脚本）', async () => {
    const svgBytes = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      // content-type 声称 svg 与伪装成 png 但内容是 svg 的两种形态都要拒
      'https://example.com/favicon.ico': imageResponse(svgBytes, 'image/svg+xml'),
      'https://favicon.im/example.com': imageResponse(svgBytes, 'image/png'),
      'https://icons.duckduckgo.com/ip3/example.com.ico': imageResponse(svgBytes, ''),
      'https://www.google.com/s2/favicons': imageResponse(svgBytes, 'image/svg+xml')
    })
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    // 200 空体 = 拒收走 miss 路径；若 SVG 被当成功响应接受，body 非空必红
    expect((await res.arrayBuffer()).byteLength).toBe(0)
    expect(res.headers.get('X-Favicon-Source')).toBe(null)
  })

  it('上游声明 text/html 但内容是 GIF 时，响应 Content-Type 强制为 image/gif 并带 nosniff', async () => {
    const gifBytes = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(gifBytes, 'text/html')
    })
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/gif')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('魔数命中 RIFF 时强制为 image/webp（不透传上游类型）', async () => {
    const riffBytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(riffBytes, 'text/plain')
    })
    const res = await invoke(makeFixture('example.com'))
    expect(res.headers.get('Content-Type')).toBe('image/webp')
  })

  it('全部源失败返回 200 空体，并写入负面缓存', async () => {
    stubFetch({})
    const fixture = makeFixture('example.com')
    const res = await invoke(fixture)
    expect(res.status).toBe(200)
    expect((await res.arrayBuffer()).byteLength).toBe(0)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=600')
    await Promise.all(fixture.waitUntilQueue)
    const keys = [...cacheStore.keys()]
    expect(keys).toHaveLength(1)
    // 缓存键带 v3 版本前缀：安全响应头策略变更时靠换键作废旧缓存
    expect(keys[0]).toBe('https://favicon-cache.local/v3/example.com')
    expect(cacheStore.get(keys[0]).status).toBe(200)
  })

  it('HTML 无图标声明时降级 favicon.ico 成功并带缓存头', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html><head></head><body></body></html>'),
      'https://example.com/favicon.ico': imageResponse(ICO_HEAD, 'image/x-icon')
    })
    const fixture = makeFixture('example.com')
    const res = await invoke(fixture)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/x-icon')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=604800')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect([...buf.slice(0, 4)]).toEqual(ICO_HEAD.slice(0, 4))
    await Promise.all(fixture.waitUntilQueue)
    expect(cacheStore.size).toBe(1)
  })

  it('从首页 HTML 解析 <link rel="icon"> 并请求声明的图标', async () => {
    const calls = stubFetch({
      'https://example.com/': htmlResponse('<html><head><link rel="icon" href="/icon.png" sizes="32x32"></head></html>'),
      'https://example.com/icon.png': imageResponse(PNG_HEAD)
    })
    const res = await invoke(makeFixture('example.com'))
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
    const res = await invoke(makeFixture('example.com'))
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
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://favicon.im/example.com')
  })

  it('content-type 缺失但魔数为图片时仍接受', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(PNG_HEAD, '')
    })
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    // 类型由魔数决定（PNG 字节 → image/png），与上游声明无关
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('超过大小上限的响应被拒绝', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(new Array(600 * 1024).fill(0x41))
    })
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
  })

  it('图标体超过 512KB 时流式截断拒收，不读完整个响应', async () => {
    // 流式 body 每 8KB 推一块、共 600KB；pull 中计数推给消费者的字节数：
    // 流式实现读到 512KB 上限附近即 cancel（不再触发 pull），整读实现（arrayBuffer）会推满 600KB
    const CHUNK = 8 * 1024
    const TOTAL = 600 * 1024
    const big = new Uint8Array(TOTAL)
    big.set(ICO_HEAD, 0)
    let sent = 0
    const stream = new ReadableStream({
      pull(controller) {
        if (sent >= TOTAL) {
          controller.close()
          return
        }
        const end = Math.min(sent + CHUNK, TOTAL)
        controller.enqueue(big.slice(sent, end))
        sent = end
      }
    })
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': () => new Response(stream, { status: 200, headers: { 'Content-Type': 'image/x-icon' } })
    })
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200) // 该源被拒，其余源失败 → 整体失败返回 200 空体
    // 交付字节数显著小于 600KB：阈值 = 512KB 上限 + 4 块 8KB 裕量
    // （读满上限后边界再读 1 块、hwm 预取回填与取消时机的差额）；
    // 整读实现推满 600KB，必然超出该阈值
    expect(sent, `sent=${sent} 超出流式截断阈值`).toBeLessThanOrEqual(MAX_ICON_BYTES + 4 * CHUNK)
    expect(sent, `sent=${sent} 推满整段 body`).toBeLessThan(TOTAL)
  })

  it('全部源挂起滴流时，总预算 5 秒内返回', async () => {
    vi.useFakeTimers()
    try {
      // 挂起的响应头 + 永不结束的 body 流
      stubFetch({
        'https://example.com/favicon.ico': () => new Response(
          new ReadableStream({ start() {} }),
          { status: 200, headers: { 'Content-Type': 'image/x-icon' } }
        )
      })
      const p = invoke(makeFixture('example.com'))
      await vi.advanceTimersByTimeAsync(5100)
      const res = await p
      expect(res.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
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
    const res = await invoke(makeFixture('example.com'))
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
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Favicon-Source')).toBe('https://example.com/favicon.ico')
  })

  it('重定向到非 http(s) 协议时该源失败', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': redirectResponse('javascript:alert(1)'),
      'https://favicon.im/example.com': imageResponse(PNG_HEAD)
    })
    const res = await invoke(makeFixture('example.com'))
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
    const res = await invoke(makeFixture('example.com'))
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
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    // 等 abort 信号传播
    await new Promise(r => setTimeout(r, 0))
    const imCall = calls.find(c => c.url.startsWith('https://favicon.im/'))
    expect(imCall).toBeTruthy()
    expect(imCall.options.signal.aborted).toBe(true)
  })

  it('缓存命中时不发起上游请求', async () => {
    const cached = imageResponse(PNG_HEAD)
    const key = new Request('https://favicon-cache.local/v3/example.com')
    cacheStore.set(key.url, cached)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await invoke(makeFixture('example.com'))
    expect(res.status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('所有响应带 CSP sandbox 与 nosniff 纵深安全头', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<html></html>'),
      'https://example.com/favicon.ico': imageResponse(PNG_HEAD)
    })
    const ok = await invoke(makeFixture('example.com'))
    expect(ok.headers.get('Content-Security-Policy')).toBe('sandbox')
    expect(ok.headers.get('X-Content-Type-Options')).toBe('nosniff')
    stubFetch({})
    const miss = await invoke(makeFixture('example.org'))
    expect(miss.headers.get('Content-Security-Policy')).toBe('sandbox')
    expect(miss.headers.get('X-Content-Type-Options')).toBe('nosniff')
    const bad = await invoke(makeFixture('evil.com/path'))
    expect(bad.status).toBe(400)
    expect(bad.headers.get('Content-Security-Policy')).toBe('sandbox')
    expect(bad.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})
