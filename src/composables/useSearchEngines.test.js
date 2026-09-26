import { describe, it, expect, beforeEach } from 'vitest'
import { SEARCH_ENGINES, useSearchEngines } from './useSearchEngines'

describe('SEARCH_ENGINES 常量', () => {
  it('每个引擎包含 id/label/icon/url/home 完整字段', () => {
    for (const engine of SEARCH_ENGINES) {
      expect(engine.id).toBeTruthy()
      expect(engine.label).toBeTruthy()
      expect(engine.icon).toBeTruthy()
      expect(engine.url).toMatch(/^https?:\/\//)
      // home 用于「空输入回车跳转引擎主页」
      expect(engine.home).toMatch(/^https?:\/\//)
    }
  })

  it('引擎 id 唯一', () => {
    const ids = SEARCH_ENGINES.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resolveAndOpen', () => {
  let setEngine, resolveAndOpen
  beforeEach(() => {
    // 每个用例独立实例：useSearchEngines() 每次返回新 ref，天然隔离
    ;({ setEngine, resolveAndOpen } = useSearchEngines())
  })

  it('空输入返回 null（由调用方决定主页跳转）', () => {
    expect(resolveAndOpen('')).toBeNull()
    expect(resolveAndOpen('   ')).toBeNull()
    expect(resolveAndOpen(null)).toBeNull()
  })

  it('完整 http/https URL 直接打开', () => {
    expect(resolveAndOpen('https://example.com/a?b=1')).toEqual({ type: 'url', target: 'https://example.com/a?b=1' })
    expect(resolveAndOpen('http://example.com')).toEqual({ type: 'url', target: 'http://example.com' })
  })

  it('纯域名自动补 https 直开', () => {
    expect(resolveAndOpen('github.com')).toEqual({ type: 'url', target: 'https://github.com' })
    expect(resolveAndOpen('example.org/path/to')).toEqual({ type: 'url', target: 'https://example.org/path/to' })
  })

  it('域名含空格按搜索处理', () => {
    const result = resolveAndOpen('github.com foo')
    expect(result.type).toBe('search')
  })

  it('普通关键词走当前引擎搜索（默认百度）', () => {
    const result = resolveAndOpen('vue3 教程')
    expect(result).toEqual({ type: 'search', target: 'https://www.baidu.com/s?wd=vue3%20%E6%95%99%E7%A8%8B' })
  })

  it('切换引擎后按新引擎搜索', () => {
    setEngine('google')
    const result = resolveAndOpen('vue')
    expect(result.target).toBe('https://www.google.com/search?q=vue')
  })

  it('切换不存在的引擎 id 保持原引擎', () => {
    setEngine('google') // 显式设定前置，不再依赖上一用例
    setEngine('not-exist')
    const result = resolveAndOpen('vue')
    expect(result.target).toBe('https://www.google.com/search?q=vue')
  })
})
