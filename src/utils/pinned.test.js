// 首屏常用站点：从书签中选出固定项（is_pinned），按 sort_order 取前 N
import { describe, it, expect } from 'vitest'
import { selectPinnedBookmarks, MAX_PINNED } from './pinned'

describe('selectPinnedBookmarks', () => {
  it('只保留 is_pinned 的书签', () => {
    const bookmarks = [
      { id: 1, is_pinned: 1, sort_order: 1 },
      { id: 2, is_pinned: 0, sort_order: 2 },
      { id: 3, sort_order: 3 }
    ]
    expect(selectPinnedBookmarks(bookmarks).map(b => b.id)).toEqual([1])
  })

  it('按 sort_order 升序排列', () => {
    const bookmarks = [
      { id: 1, is_pinned: 1, sort_order: 30 },
      { id: 2, is_pinned: 1, sort_order: 10 },
      { id: 3, is_pinned: 1, sort_order: 20 }
    ]
    expect(selectPinnedBookmarks(bookmarks).map(b => b.id)).toEqual([2, 3, 1])
  })

  it('最多取 MAX_PINNED（10）个', () => {
    const bookmarks = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, is_pinned: 1, sort_order: i + 1
    }))
    const result = selectPinnedBookmarks(bookmarks)
    expect(result).toHaveLength(10)
    expect(result[9].id).toBe(10)
  })

  it('空数组或无固定项时返回空数组', () => {
    expect(selectPinnedBookmarks([])).toEqual([])
    expect(selectPinnedBookmarks([{ id: 1, is_pinned: 0 }])).toEqual([])
  })

  it('不修改传入数组', () => {
    const bookmarks = [
      { id: 2, is_pinned: 1, sort_order: 2 },
      { id: 1, is_pinned: 1, sort_order: 1 }
    ]
    selectPinnedBookmarks(bookmarks)
    expect(bookmarks.map(b => b.id)).toEqual([2, 1])
  })
})
