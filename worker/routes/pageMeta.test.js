// GET /api/page-meta 单测：抓取目标页 HTML 提取标题/描述，失败回退空字段
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handle, FETCH_TIMEOUT_MS } from './pageMeta.js'

function makeRequest(url, { method = 'GET' } = {}) {
  const u = new URL('https://site.example/api/page-meta')
  if (url !== null) u.searchParams.set('url', url)
  return new Request(u, { method })
}

const invoke = (req) => handle(req, { ADMIN_PASSWORD: 'secret' }, {}, {})

beforeEach(() => {
  vi.unstubAllGlobals()
})

function htmlResponse(html, contentType = 'text/html; charset=utf-8') {
  return new Response(html, { status: 200, headers: { 'Content-Type': contentType } })
}

// 按 URL 精确匹配返回预设响应，未命中视为连接失败；记录每次调用的 url 与 options
function stubFetch(byUrl) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    calls.push({ url, options })
    const hit = byUrl[url]
    if (!hit) throw new Error('ECONNREFUSED')
    return typeof hit === 'function' ? await hit() : hit
  }))
  return calls
}

describe('GET /api/page-meta 参数校验', () => {
  it('非 GET 请求返回 405 METHOD_NOT_ALLOWED', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await invoke(makeRequest('https://example.com', { method: 'POST' }))
    expect(res.status).toBe(405)
    expect((await res.json()).code).toBe('METHOD_NOT_ALLOWED')
  })

  it('url 缺失返回 400 URL不能为空', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await invoke(makeRequest(null))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('URL不能为空')
  })

  it('url 非法返回 400 URL格式不正确', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await invoke(makeRequest('not a url'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('URL格式不正确')
  })

  it('非 http/https 协议返回 400 仅支持 http/https 链接', async () => {
    vi.stubGlobal('fetch', vi.fn())
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.com']) {
      const res = await invoke(makeRequest(bad))
      expect(res.status, bad).toBe(400)
      expect((await res.json()).error).toBe('仅支持 http/https 链接')
    }
  })

  it('url 超长返回 400 URL 不能超过 2048 个字符', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await invoke(makeRequest('https://example.com/' + 'a'.repeat(2048)))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('URL 不能超过 2048 个字符')
  })
})

describe('GET /api/page-meta 提取规则', () => {
  it('标题优先 <title>，缺失或空白时退 og:title', async () => {
    stubFetch({
      'https://example.com/': htmlResponse('<head><title>页面标题</title><meta property="og:title" content="OG标题"></head>')
    })
    expect(await (await invoke(makeRequest('https://example.com/'))).json())
      .toEqual({ title: '页面标题', description: '' })

    stubFetch({
      'https://example.com/': htmlResponse('<head><meta property="og:title" content="OG标题"></head>')
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).title).toBe('OG标题')

    stubFetch({
      'https://example.com/': htmlResponse('<head><title>   </title><meta property="og:title" content="OG标题"></head>')
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).title).toBe('OG标题')
  })

  it('描述优先 meta description，缺失时退 og:description', async () => {
    stubFetch({
      'https://example.com/': htmlResponse(
        '<head><title>T</title><meta name="description" content="站点描述"><meta property="og:description" content="OG描述"></head>'
      )
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).description).toBe('站点描述')

    stubFetch({
      'https://example.com/': htmlResponse(
        '<head><title>T</title><meta property="og:description" content="OG描述"></head>'
      )
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).description).toBe('OG描述')
  })

  it('HTML 实体解码、空白折叠、单引号属性可解析', async () => {
    stubFetch({
      'https://example.com/': htmlResponse(
        "<head><title>\n  A &amp; B &#x4E2D;  \n</title><meta name='description' content='多 行\n 描述&nbsp;X'></head>"
      )
    })
    const data = await (await invoke(makeRequest('https://example.com/'))).json()
    expect(data.title).toBe('A & B 中')
    expect(data.description).toBe('多 行 描述 X')
  })

  it('标题/描述按码点截断到 200/2000 字符', async () => {
    stubFetch({
      'https://example.com/': htmlResponse(
        `<head><title>${'标'.repeat(250)}</title><meta name="description" content="${'述'.repeat(2100)}"></head>`
      )
    })
    const data = await (await invoke(makeRequest('https://example.com/'))).json()
    expect(data.title).toBe('标'.repeat(200))
    expect(data.description).toBe('述'.repeat(2000))
  })

  it('按 Content-Type charset 解码（GBK 中文不乱码）', async () => {
    // 「中文」的 GBK 编码为 D6 D0 CE C4
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<head><title>'),
      0xd6, 0xd0, 0xce, 0xc4,
      ...new TextEncoder().encode('</title></head>')
    ])
    stubFetch({
      'https://example.com/': new Response(bytes, { status: 200, headers: { 'Content-Type': 'text/html; charset=gbk' } })
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).title).toBe('中文')
  })

  it('无 charset 时嗅探 meta charset，缺失则按 utf-8 解码', async () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<head><meta charset="gbk"><title>'),
      0xd6, 0xd0, 0xce, 0xc4,
      ...new TextEncoder().encode('</title></head>')
    ])
    stubFetch({
      'https://example.com/': new Response(bytes, { status: 200, headers: { 'Content-Type': 'text/html' } })
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).title).toBe('中文')

    stubFetch({
      'https://example.com/': htmlResponse('<head><title>纯文本</title></head>', 'text/html')
    })
    expect((await (await invoke(makeRequest('https://example.com/'))).json()).title).toBe('纯文本')
  })
})

describe('GET /api/page-meta 失败语义', () => {
  const EMPTY = { title: '', description: '' }

  it('抓取异常返回 200 空字段', async () => {
    stubFetch({})
    const res = await invoke(makeRequest('https://example.com/'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(EMPTY)
  })

  it('非 HTML 内容类型返回 200 空字段', async () => {
    // 夹具带 <title> 标记：无内容类型拦截时会被误提取，确保此测试能抓住该行为
    stubFetch({
      'https://example.com/': new Response('<title>不该被提取</title>', { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    expect(await (await invoke(makeRequest('https://example.com/'))).json()).toEqual(EMPTY)
  })

  it('HTTP 非 2xx 返回 200 空字段', async () => {
    // 404 页面的 <title> 不应被当成站点标题
    const notFound = new Response('<head><title>404 Not Found</title></head>', { status: 404, headers: { 'Content-Type': 'text/html' } })
    stubFetch({ 'https://example.com/': notFound })
    expect(await (await invoke(makeRequest('https://example.com/'))).json()).toEqual(EMPTY)
  })

  it('抓取超时返回 200 空字段', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('fetch', vi.fn((_url, options = {}) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })))
      const pending = invoke(makeRequest('https://example.com/'))
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 10)
      const res = await pending
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(EMPTY)
    } finally {
      vi.useRealTimers()
    }
  })
})
