import { describe, it, expect } from 'vitest'
import { CATEGORY_ICONS, CATEGORY_ICON_DEFAULT, resolveCategoryIcon } from './categoryIcons'

describe('categoryIcons', () => {
  it('预设清单全部为 ri- 开头且含默认图标', () => {
    expect(CATEGORY_ICONS.length).toBe(32)
    CATEGORY_ICONS.forEach(name => expect(name.startsWith('ri-')).toBe(true))
    expect(CATEGORY_ICONS).toContain(CATEGORY_ICON_DEFAULT)
  })

  it('ri- 开头的图标名原样返回', () => {
    expect(resolveCategoryIcon('ri-home-line')).toBe('ri-home-line')
  })

  it('旧 emoji、空值与非法值回退默认图标', () => {
    expect(resolveCategoryIcon('📁')).toBe(CATEGORY_ICON_DEFAULT)
    expect(resolveCategoryIcon('')).toBe(CATEGORY_ICON_DEFAULT)
    expect(resolveCategoryIcon(undefined)).toBe(CATEGORY_ICON_DEFAULT)
    expect(resolveCategoryIcon(123)).toBe(CATEGORY_ICON_DEFAULT)
  })
})
