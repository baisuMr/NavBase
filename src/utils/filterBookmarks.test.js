// 书签按选中 tab 筛选：'all' 全部、'uncategorized' 未分类、数字 id 按分类
import { describe, it, expect } from 'vitest'
import { filterBookmarks } from './filterBookmarks'

const BOOKMARKS = [
  { id: 1, category_id: 1 },
  { id: 2, category_id: 2 },
  { id: 3, category_id: null },
  { id: 4 } // 缺省 category_id 视为未分类
]

describe('filterBookmarks', () => {
  it("'all' 返回全部书签", () => {
    expect(filterBookmarks(BOOKMARKS, 'all').map((b) => b.id)).toEqual([1, 2, 3, 4])
  })

  it("'uncategorized' 只返回未分类书签（category_id 为 null 或缺省）", () => {
    expect(filterBookmarks(BOOKMARKS, 'uncategorized').map((b) => b.id)).toEqual([3, 4])
  })

  it('数字 id 按分类筛选', () => {
    expect(filterBookmarks(BOOKMARKS, 1).map((b) => b.id)).toEqual([1])
  })

  it('未知分类 id 返回空数组', () => {
    expect(filterBookmarks(BOOKMARKS, 99)).toEqual([])
  })
})
