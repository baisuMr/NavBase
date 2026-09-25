// worker/utils/base64.test.js
import { describe, it, expect } from 'vitest'
import { utf8ToBase64, base64ToUtf8 } from './base64.js'

describe('UTF-8 安全 Base64', () => {
  it('中文凭据可编解码往返', () => {
    const s = '用户名:密码含中文✓'
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s)
  })
  it('与原 btoa 兼容：ASCII 串编码结果一致', () => {
    expect(utf8ToBase64('admin:pass')).toBe(btoa('admin:pass'))
  })
  it('非法 base64 返回 null 而不抛错', () => {
    expect(base64ToUtf8('!!!')).toBeNull()
  })
})
