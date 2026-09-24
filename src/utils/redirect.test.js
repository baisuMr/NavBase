import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from './redirect'

describe('safeRedirectPath', () => {
  it('站内绝对路径原样保留', () => {
    expect(safeRedirectPath('/quick-add?url=a&title=b')).toBe('/quick-add?url=a&title=b')
    expect(safeRedirectPath('/')).toBe('/')
  })

  it('协议相对与绝对 URL 一律回首页（防开放重定向）', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('http://evil.com/x')).toBe('/')
  })

  it('非字符串或空值回首页', () => {
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
    expect(safeRedirectPath(123)).toBe('/')
  })
})
