// @vitest-environment happy-dom
// 书签 store 固定/取消固定：翻转 is_pinned 提交更新并刷新列表（供首屏常用站点与右键菜单使用）
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../api/bookmarks', () => ({
  bookmarksApi: {
    getAll: vi.fn(),
    update: vi.fn()
  }
}))

import { bookmarksApi } from '../api/bookmarks'
import { useBookmarksStore } from './bookmarks'

const PINNABLE = {
  id: 3,
  title: 't',
  url: 'https://a.com',
  description: '',
  category_id: 1,
  icon_url: '',
  is_pinned: 0
}

describe('bookmarks store togglePin', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    bookmarksApi.getAll.mockResolvedValue([])
    bookmarksApi.update.mockResolvedValue({ success: true })
  })

  it('未固定的书签转固定时提交 is_pinned: 1 并刷新列表', async () => {
    const store = useBookmarksStore()
    await store.togglePin(PINNABLE)
    expect(bookmarksApi.update).toHaveBeenCalledWith(3, expect.objectContaining({ is_pinned: 1 }))
    expect(bookmarksApi.getAll).toHaveBeenCalled()
  })

  it('已固定的书签取消固定时提交 is_pinned: 0', async () => {
    const store = useBookmarksStore()
    await store.togglePin({ ...PINNABLE, is_pinned: 1 })
    expect(bookmarksApi.update).toHaveBeenCalledWith(3, expect.objectContaining({ is_pinned: 0 }))
  })

  it('提交载荷携带完整书签字段（PUT 全量替换，缺字段会清空描述等）', async () => {
    const store = useBookmarksStore()
    await store.togglePin({ ...PINNABLE, description: 'd', icon_url: 'https://i.png' })
    expect(bookmarksApi.update).toHaveBeenCalledWith(3, {
      title: 't',
      url: 'https://a.com',
      description: 'd',
      category_id: 1,
      icon_url: 'https://i.png',
      is_pinned: 1
    })
  })
})
