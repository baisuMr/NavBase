// @vitest-environment happy-dom
// page-meta API 封装：目标 URL 编码进查询串、取消信号透传给 fetch
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ clearAuth: vi.fn(), getAuthHeaders: () => ({}) })
}))

import { pageMetaApi } from './pageMeta'

describe('pageMetaApi', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('把目标 URL 编码进查询串', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ title: 'T', description: '' })))
    vi.stubGlobal('fetch', fetchSpy)

    await pageMetaApi.get('https://example.com/a?b=1&c=2')

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/page-meta?url=' + encodeURIComponent('https://example.com/a?b=1&c=2'))
  })

  it('透传调用方取消信号', async () => {
    let seenSignal
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      seenSignal = init.signal
      return new Response('{}')
    }))

    const ctl = new AbortController()
    await pageMetaApi.get('https://example.com', ctl.signal)

    expect(seenSignal).toBe(ctl.signal)
  })
})
