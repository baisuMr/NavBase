import { describe, it, expect } from 'vitest'
import { isAllowedUrl } from './url'

describe('isAllowedUrl 协议白名单', () => {
  it('允许 http/https（含大写协议与首尾空白）', () => {
    expect(isAllowedUrl('https://example.com')).toBe(true)
    expect(isAllowedUrl('http://example.com')).toBe(true)
    expect(isAllowedUrl('HTTPS://EXAMPLE.COM/path?q=1')).toBe(true)
    expect(isAllowedUrl('  https://example.com  ')).toBe(true)
  })

  it('拒绝 javascript: 等危险协议', () => {
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedUrl('JavaScript:alert(1)')).toBe(false)
    expect(isAllowedUrl('data:text/html,<script>')).toBe(false)
    expect(isAllowedUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedUrl('ftp://example.com')).toBe(false)
  })

  it('拒绝空值、纯域名与相对路径', () => {
    expect(isAllowedUrl('')).toBe(false)
    expect(isAllowedUrl(null)).toBe(false)
    expect(isAllowedUrl(undefined)).toBe(false)
    expect(isAllowedUrl('example.com')).toBe(false)
    expect(isAllowedUrl('/path/to/page')).toBe(false)
  })
})
