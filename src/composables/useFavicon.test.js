import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useFavicon } from './useFavicon'
import { initFaviconKey, clearFaviconKey } from '../utils/faviconKey'

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
    expect(iconSrc(bookmark())).toBe(`/api/favicon/example.com?k=${K}`)
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
    expect(iconSrc(bm)).toBe(`/api/favicon/example.com?k=${K}`)
  })

  it('keyOf 无 id 时用 url 兜底，失败记录互不影响', async () => {
    await initFaviconKey(TOKEN)
    const { iconSrc, onIconError } = useFavicon()
    const a = bookmark({ id: 1, url: 'https://a.com' })
    const b = bookmark({ id: 2, url: 'https://b.com' })
    onIconError(a)
    expect(iconSrc(a)).toBe('')
    expect(iconSrc(b)).toBe(`/api/favicon/b.com?k=${K}`)
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
})

afterEach(() => {
  vi.useRealTimers()
})
