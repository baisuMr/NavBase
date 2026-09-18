// 批量导入校验逻辑单测：协议白名单与字段类型
import { describe, it, expect } from 'vitest'
import { validateBookmark } from './batch.js'

describe('validateBookmark 协议白名单', () => {
  const blocked = [
    ['javascript:alert(1)', 'js 协议'],
    ['JaVaScRiPt:alert(1)', '大小写混合 js 协议'],
    ['data:text/html,<b>x</b>', 'data 协议'],
    ['vbscript:x', 'vbscript 协议'],
    ['file:///c:/windows', 'file 协议'],
    [' javascript:alert(1)', '前导空格 js 协议'],
    ['java\nscript:alert(1)', '换行拆分 js 协议'],
    ['//evil.com', '协议相对地址'],
    ['http://', '空主机名'],
    ['ftp://files.example.com', 'ftp 协议']
  ]
  for (const [url, label] of blocked) {
    it(`拦截 ${label}`, () => {
      expect(validateBookmark({ title: 't', url })).toMatch(/仅支持|格式不正确/)
    })
  }

  const allowed = [
    ['https://example.com', 'https'],
    ['http://example.com', 'http'],
    ['https://example.com/a?b=1#c', '带查询与锚点']
  ]
  for (const [url, label] of allowed) {
    it(`放行 ${label}`, () => {
      expect(validateBookmark({ title: 't', url })).toBeNull()
    })
  }
})

describe('validateBookmark 字段校验', () => {
  it('缺失字段返回错误', () => {
    expect(validateBookmark(null)).toBeTruthy()
    expect(validateBookmark({})).toBeTruthy()
    expect(validateBookmark({ title: 't' })).toBeTruthy()
    expect(validateBookmark({ url: 'https://a.com' })).toBeTruthy()
  })

  it('纯空白标题被拒绝', () => {
    expect(validateBookmark({ title: '   ', url: 'https://a.com' })).toBeTruthy()
  })

  it('非字符串标题被拒绝', () => {
    expect(validateBookmark({ title: 123, url: 'https://a.com' })).toBeTruthy()
  })

  it('非法类型 category_id / sort_order 返回错误而非 500', () => {
    expect(validateBookmark({ title: 't', url: 'https://a.com', category_id: 'abc' })).toMatch(/分类ID/)
    expect(validateBookmark({ title: 't', url: 'https://a.com', sort_order: { a: 1 } })).toMatch(/排序/)
  })

  it('合法类型通过', () => {
    expect(validateBookmark({
      title: 't',
      url: 'https://a.com',
      description: 'd',
      category_id: 3,
      sort_order: 0,
      icon_url: ''
    })).toBeNull()
  })
})
