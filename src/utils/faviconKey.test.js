import { describe, it, expect, beforeEach } from 'vitest'
import { initFaviconKey, getFaviconKey, clearFaviconKey } from './faviconKey'

const TOKEN = 'YWRtaW46c2VjcmV0'
const K = '8cpjAAtxx2rvatP2WcPbyZJvRIdWpIZ0OyT5SqVOmlU'

describe('faviconKey 派生', () => {
  beforeEach(() => clearFaviconKey())

  it('固定测试向量 token → k（与 worker 侧同一期望值）', async () => {
    expect(await initFaviconKey(TOKEN)).toBe(K)
    expect(getFaviconKey()).toBe(K)
  })

  it('空 token 清空 key', async () => {
    await initFaviconKey(TOKEN)
    await initFaviconKey('')
    expect(getFaviconKey()).toBe('')
  })

  it('clearFaviconKey 清空', async () => {
    await initFaviconKey(TOKEN)
    clearFaviconKey()
    expect(getFaviconKey()).toBe('')
  })
})
