import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useFavicon } from './useFavicon'

// 失败回退 TTL 与后端负面缓存 MISS_TTL（10 分钟）对齐
const FAILED_TTL = 10 * 60 * 1000

function bookmark(overrides = {}) {
  return { id: 1, title: 'Example', url: 'https://www.example.com/page', icon_url: '', ...overrides }
}

describe('useFavicon 图标解析', () => {
  it('icon_url 非空直接使用', () => {
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark({ icon_url: 'https://cdn.x/i.png' }))).toBe('https://cdn.x/i.png')
  })

  it('icon_url 为空走代理（域名去 www）', () => {
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark())).toBe('/api/favicon/example.com')
  })

  it('URL 非法时返回空', () => {
    const { iconSrc } = useFavicon()
    expect(iconSrc(bookmark({ url: 'not-a-url' }))).toBe('')
  })

  it('加载失败后 TTL 内持续回退空（渲染首字头像）', () => {
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark()
    onIconError(bm)
    expect(iconSrc(bm)).toBe('')
    vi.advanceTimersByTime(FAILED_TTL - 1)
    expect(iconSrc(bm)).toBe('')
  })

  it('失败超过 TTL 后自动恢复重试', () => {
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark()
    onIconError(bm)
    expect(iconSrc(bm)).toBe('')
    vi.advanceTimersByTime(FAILED_TTL + 1)
    expect(iconSrc(bm)).toBe('/api/favicon/example.com')
  })

  it('TTL 内即使编辑了 icon_url 也保持回退，过期后优先 icon_url', () => {
    const { iconSrc, onIconError } = useFavicon()
    const bm = bookmark({ icon_url: 'https://cdn.x/i.png' })
    onIconError(bm)
    expect(iconSrc(bm)).toBe('')
    vi.advanceTimersByTime(FAILED_TTL + 1)
    expect(iconSrc(bm)).toBe('https://cdn.x/i.png')
  })

  it('keyOf 无 id 时用 url 兜底，失败记录互不影响', () => {
    const { iconSrc, onIconError } = useFavicon()
    const a = bookmark({ id: 1, url: 'https://a.com' })
    const b = bookmark({ id: 2, url: 'https://b.com' })
    onIconError(a)
    expect(iconSrc(a)).toBe('')
    expect(iconSrc(b)).toBe('/api/favicon/b.com')
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
})

afterEach(() => {
  vi.useRealTimers()
})
