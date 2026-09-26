// worker/utils/faviconKey.test.js
import { describe, it, expect } from 'vitest'
import { deriveFaviconKey, isValidFaviconKey } from './faviconKey.js'

// 固定向量与 src/utils/faviconKey.test.js 共用，锁定前后端派生算法一致
const TOKEN = 'YWRtaW46c2VjcmV0' // Base64('admin:secret')
const K = '8cpjAAtxx2rvatP2WcPbyZJvRIdWpIZ0OyT5SqVOmlU'

describe('deriveFaviconKey', () => {
  it('固定测试向量 token → k', async () => {
    expect(await deriveFaviconKey(TOKEN)).toBe(K)
  })
})

describe('isValidFaviconKey', () => {
  const env = { ADMIN_PASSWORD: 'secret' }

  it('正确 k 通过', async () => {
    expect(await isValidFaviconKey(K, env)).toBe(true)
  })

  it('错误 k / 缺失 k 拒绝', async () => {
    expect(await isValidFaviconKey('bad', env)).toBe(false)
    expect(await isValidFaviconKey('', env)).toBe(false)
    expect(await isValidFaviconKey(null, env)).toBe(false)
    expect(await isValidFaviconKey(undefined, env)).toBe(false)
  })

  it('未配置 ADMIN_PASSWORD 时拒绝', async () => {
    expect(await isValidFaviconKey(K, {})).toBe(false)
  })

  it('改密码后旧 k 失效', async () => {
    expect(await isValidFaviconKey(K, { ADMIN_PASSWORD: 'other' })).toBe(false)
  })
})
