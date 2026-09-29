import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed } from 'vue'
import { useFavicon } from './useFavicon'
import { initFaviconKey, clearFaviconKey, setFaviconCacheVer } from '../utils/faviconKey'

// 失败回退 TTL 与后端负面缓存 MISS_TTL（10 分钟）对齐
const FAILED_TTL = 10 * 60 * 1000
const TOKEN = 'YWRtaW46c2VjcmV0'
const K = '8cpjAAtxx2rvatP2WcPbyZJvRIdWpIZ0OyT5SqVOmlU'

function bookmark(overrides = {}) {
  return { id: 1, title: 'Example', url: 'https://www.example.com/page', ...overrides }
}

describe('useFavicon 图标解析', () => {
  it('一律走代理并携带 k（域名去 www）', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark())).toBe(`/api/favicon/example.com?k=${K}&v=1`)
  })

  it('k 未就绪返回空（渲染首字头像，不发无 k 请求）', () => {
    clearFaviconKey()
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark())).toBe('')
  })

  it('URL 非法时返回空', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark({ url: 'not-a-url' }))).toBe('')
  })

  it('localhost/内网 IP 等非法域名不拼代理地址（与后端 ALLOWED_DOMAIN 口径一致）', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark({ url: 'http://localhost:5173' }))).toBe('')
    expect(iconSrc(bookmark({ url: 'http://192.168.1.1/admin' }))).toBe('')
    expect(iconSrc(bookmark({ url: 'http://intranet' }))).toBe('')
    // 合法多级域名正常拼代理
    expect(iconSrc(bookmark({ url: 'https://sub.example.co.uk/x' })))
      .toBe(`/api/favicon/sub.example.co.uk?k=${K}&v=1`)
  })

  it('加载失败后 TTL 内持续回退空（渲染首字头像）', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark()
    onIconError(bm)
    expect(iconSrc(bm)).toBe('')
    vi.advanceTimersByTime(FAILED_TTL - 1)
    expect(iconSrc(bm)).toBe('')
  })

  it('失败超过 TTL 后自动恢复重试', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark()
    onIconError(bm)
    expect(iconSrc(bm)).toBe('')
    vi.advanceTimersByTime(FAILED_TTL + 1)
    expect(iconSrc(bm)).toBe(`/api/favicon/example.com?k=${K}&v=1`)
  })

  it('失败记录按 url 键控，不同 url 互不影响', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc, onIconError } = useFavicon()
    const a = bookmark({ id: undefined, url: 'https://a.com' })
    const b = bookmark({ id: undefined, url: 'https://b.com' })
    onIconError(a)
    expect(iconSrc(a)).toBe('')
    expect(iconSrc(b)).toBe(`/api/favicon/b.com?k=${K}&v=1`)
  })

  it('编辑书签更换 URL 后失败态不延续到新域名', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark({ id: 1, url: 'https://old.com' })
    onIconError(bm)
    expect(iconSrc(bm)).toBe('')
    // 同一书签编辑换成新域名：失败态不按 id 延续，新域名立即重试
    const edited = bookmark({ id: 1, url: 'https://new.com' })
    expect(iconSrc(edited)).toBe(`/api/favicon/new.com?k=${K}&v=1`)
  })

  it('失败 TTL 到期后自动触发重渲染恢复重试（闲置页面无需再次渲染）', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark()
    onIconError(bm)
    const src = computed(() => iconSrc(bm))
    expect(src.value).toBe('')
    // 到期仅靠计时器清失败记录：若无重渲染触发源，computed 不会重新求值
    vi.advanceTimersByTime(FAILED_TTL + 1)
    expect(src.value).toBe(`/api/favicon/example.com?k=${K}&v=1`)
  })

  it('图标 URL 携带缓存世代 v，换代即 URL 变化（清除图标缓存机制）', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark())).toContain('&v=1')
    setFaviconCacheVer(1759100000000)
    expect(iconSrc(bookmark())).toContain('&v=1759100000000')
    // 非法值归一默认
    setFaviconCacheVer('x')
    expect(iconSrc(bookmark())).toContain('&v=1')
  })

  it('iconInitial 取标题首字符（中文/emoji 兼容），无标题退域名首字符', () => {
    const { iconInitial } = useFavicon()
    expect(iconInitial(bookmark({ title: '哔哩哔哩' }))).toBe('哔')
    expect(iconInitial(bookmark({ title: '🎬 视频' }))).toBe('🎬')
    expect(iconInitial(bookmark({ title: '' }))).toBe('E')
    expect(iconInitial(bookmark({ title: '', url: 'bad' }))).toBe('?')
  })
})

beforeEach(() => {
  vi.useFakeTimers()
  clearFaviconKey()
  setFaviconCacheVer(1)
})

afterEach(() => {
  vi.useRealTimers()
})
