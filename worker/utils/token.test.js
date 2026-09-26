// worker/utils/token.test.js
import { describe, it, expect } from 'vitest'
import { expectedToken } from './token.js'

describe('expectedToken', () => {
  it('默认用户名 admin', () => {
    expect(expectedToken({ ADMIN_PASSWORD: 'pw' })).toBe('YWRtaW46cHc=')
  })

  it('自定义用户名与含空格密码（UTF-8 安全）', () => {
    expect(expectedToken({ ADMIN_USERNAME: 'u', ADMIN_PASSWORD: 'p w' })).toBe('dTpwIHc=')
  })
})
