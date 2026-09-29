// 「全部」视图书签按分类分组：分类序在前、未分类垫后、空分类跳过
import { describe, it, expect } from 'vitest'
import { groupBookmarksByCategory, groupsForView } from './groupBookmarks'

const CATEGORIES = [
  { id: 1, name: '常用' },
  { id: 2, name: '工具' },
  { id: 3, name: '空分类' }
]

const BOOKMARKS = [
  { id: 11, category_id: 2 },
  { id: 12, category_id: 1 },
  { id: 13, category_id: null },
  { id: 14, category_id: 1 },
  { id: 15 } // 缺省 category_id 视为未分类
]

describe('groupBookmarksByCategory', () => {
  it('按分类顺序分组，组内保持输入顺序', () => {
    const groups = groupBookmarksByCategory(BOOKMARKS, CATEGORIES)
    expect(groups.map((g) => g.type)).toEqual(['category', 'category', 'uncategorized'])
    expect(groups[0].category.id).toBe(1)
    expect(groups[0].bookmarks.map((b) => b.id)).toEqual([12, 14])
    expect(groups[1].category.id).toBe(2)
    expect(groups[1].bookmarks.map((b) => b.id)).toEqual([11])
  })

  it('未分类组垫后且无 category 字段', () => {
    const groups = groupBookmarksByCategory(BOOKMARKS, CATEGORIES)
    const last = groups[groups.length - 1]
    expect(last.type).toBe('uncategorized')
    expect(last.category).toBeUndefined()
    expect(last.bookmarks.map((b) => b.id)).toEqual([13, 15])
  })

  it('空分类跳过不渲染组', () => {
    const groups = groupBookmarksByCategory(BOOKMARKS, CATEGORIES)
    expect(groups.some((g) => g.category?.id === 3)).toBe(false)
  })

  it('无未分类书签时不产生未分类组', () => {
    const groups = groupBookmarksByCategory(
      [
        { id: 21, category_id: 1 },
        { id: 22, category_id: 2 }
      ],
      CATEGORIES
    )
    expect(groups.map((g) => g.type)).toEqual(['category', 'category'])
  })

  it('全部为空书签返回空数组', () => {
    expect(groupBookmarksByCategory([], CATEGORIES)).toEqual([])
    expect(groupBookmarksByCategory(undefined, CATEGORIES)).toEqual([])
  })

  it('category_id 不属于任何已知分类的书签归入未分类组（保证「全部」不丢书签）', () => {
    const groups = groupBookmarksByCategory(
      [
        { id: 31, category_id: 1 },
        { id: 32, category_id: 99 }
      ],
      CATEGORIES
    )
    const last = groups[groups.length - 1]
    expect(last.type).toBe('uncategorized')
    expect(last.bookmarks.map((b) => b.id)).toEqual([32])
  })
})

describe('groupsForView', () => {
  it("'all' 与 groupBookmarksByCategory 一致", () => {
    expect(groupsForView(BOOKMARKS, CATEGORIES, 'all')).toEqual(groupBookmarksByCategory(BOOKMARKS, CATEGORIES))
  })

  it("'uncategorized' 返回单个未分类组（无书签也出组，供块内空态）", () => {
    const groups = groupsForView(BOOKMARKS, CATEGORIES, 'uncategorized')
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('uncategorized')
    expect(groups[0].bookmarks.map((b) => b.id)).toEqual([13, 15])
    expect(groupsForView([], CATEGORIES, 'uncategorized')).toEqual([{ type: 'uncategorized', bookmarks: [] }])
  })

  it('数字 id 返回单个分类组（无书签也出组，供块内空态）', () => {
    const groups = groupsForView(BOOKMARKS, CATEGORIES, 1)
    expect(groups).toHaveLength(1)
    expect(groups[0].category.id).toBe(1)
    expect(groups[0].bookmarks.map((b) => b.id)).toEqual([12, 14])
    expect(groupsForView([], CATEGORIES, 1)[0].bookmarks).toEqual([])
  })

  it('未知分类 id 返回空数组', () => {
    expect(groupsForView(BOOKMARKS, CATEGORIES, 99)).toEqual([])
  })
})
