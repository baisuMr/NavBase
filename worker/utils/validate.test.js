// 字段长度上限校验单测：超长拒绝、边界放行、类型错误优先于长度错误
import { describe, it, expect } from 'vitest'
import { validateBookmarkPayload, validateCategoryPayload } from './validate.js'

// 构造恰好超限的合法 URL（总长 2049，协议仍为 https）
const urlOfLength = (n) => {
  const prefix = 'https://a.com/'
  return prefix + 'x'.repeat(n - prefix.length)
}

describe('validateBookmarkPayload 字段长度上限', () => {
  it('超长字段被拒绝', () => {
    expect(validateBookmarkPayload({ title: 'a'.repeat(201), url: 'https://a.com' })).toMatch(/标题不能超过/)
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', description: 'd'.repeat(2001) })).toMatch(/描述不能超过/)
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', icon_url: 'u'.repeat(501) })).toMatch(/图标/)
    expect(validateBookmarkPayload({ title: 't', url: urlOfLength(2049) })).toMatch(/URL 不能超过/)
  })

  it('恰好达到上限放行', () => {
    expect(validateBookmarkPayload({ title: 'a'.repeat(200), url: 'https://a.com' })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', description: 'd'.repeat(2000) })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', icon_url: 'u'.repeat(500) })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: urlOfLength(2048) })).toBeNull()
  })

  it('类型错误优先于长度错误', () => {
    // 标题超长但描述类型非法：先报类型错误
    expect(validateBookmarkPayload({ title: 'a'.repeat(201), url: 'https://a.com', description: 123 })).toMatch(/类型不正确/)
    // 标题超长但 URL 协议非法：先报协议错误
    expect(validateBookmarkPayload({ title: 'a'.repeat(201), url: 'javascript:alert(1)' })).toMatch(/仅支持/)
    // 非字符串标题不落入长度比较
    expect(validateBookmarkPayload({ title: 123, url: 'https://a.com' })).toBeTruthy()
  })

  it('可选字段缺省不报长度错误', () => {
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com' })).toBeNull()
    expect(validateBookmarkPayload({ title: 't', url: 'https://a.com', description: null, icon_url: null })).toBeNull()
  })
})

describe('validateCategoryPayload 字段长度上限', () => {
  it('超长名称被拒绝', () => {
    expect(validateCategoryPayload({ name: 'n'.repeat(51) })).toMatch(/名称不能超过/)
  })

  it('恰好 50 字放行', () => {
    expect(validateCategoryPayload({ name: 'n'.repeat(50) })).toBeNull()
  })

  it('类型错误优先于长度错误', () => {
    expect(validateCategoryPayload({ name: 'n'.repeat(51), sort_order: 'abc' })).toMatch(/排序字段类型不正确/)
    expect(validateCategoryPayload({ name: 123 })).toMatch(/分类名称不能为空/)
  })
})
