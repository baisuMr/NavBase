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

  it('提交载荷不再携带 icon_url（弃用式收编，PUT 其余字段完整）', async () => {
    const store = useBookmarksStore()
    await store.togglePin({ ...PINNABLE, description: 'd', icon_url: 'https://i.png' })
    expect(bookmarksApi.update).toHaveBeenCalledWith(3, {
      title: 't',
      url: 'https://a.com',
      description: 'd',
      category_id: 1,
      is_pinned: 1
    })
  })
})

describe('bookmarks store fetchBookmarks 失败路径', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    bookmarksApi.getAll.mockResolvedValue([])
  })

  it('加载失败时写入 error 且不覆盖已有数据', async () => {
    bookmarksApi.getAll.mockRejectedValue(new Error('网络错误'))
    const store = useBookmarksStore()
    store.bookmarks = [{ id: 1 }]
    await store.fetchBookmarks()
    expect(store.error).toBe('网络错误')
    expect(store.bookmarks).toHaveLength(1) // 失败不清空旧数据
    expect(store.loading).toBe(false)
  })

  it('失败后再次拉取成功时清除 error 并更新数据', async () => {
    bookmarksApi.getAll.mockRejectedValue(new Error('网络错误'))
    const store = useBookmarksStore()
    await store.fetchBookmarks()
    bookmarksApi.getAll.mockResolvedValue([{ id: 2 }])
    await store.fetchBookmarks()
    expect(store.error).toBeNull()
    expect(store.bookmarks).toHaveLength(1)
  })
})

describe('bookmarks store fetchBookmarks 请求序号', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    bookmarksApi.getAll.mockResolvedValue([])
  })

  it('过期响应不覆盖新数据', async () => {
    const store = useBookmarksStore()
    let resolveFirst
    bookmarksApi.getAll
      .mockImplementationOnce(() => new Promise(r => { resolveFirst = r }))
      .mockImplementationOnce(async () => [{ id: 2 }])
    const p1 = store.fetchBookmarks()
    const p2 = store.fetchBookmarks()
    await p2
    resolveFirst([{ id: 1 }]) // 旧请求晚到
    await p1
    expect(store.bookmarks.map(b => b.id)).toEqual([2])
    expect(store.loading).toBe(false)
  })

  it('过期请求失败不写入 error 也不影响 loading 复位', async () => {
    const store = useBookmarksStore()
    let rejectFirst
    bookmarksApi.getAll
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej }))
      .mockImplementationOnce(async () => [{ id: 2 }])
    const p1 = store.fetchBookmarks()
    const p2 = store.fetchBookmarks()
    await p2
    rejectFirst(new Error('过期错误')) // 旧请求晚到且失败
    await p1
    expect(store.error).toBeNull()
    expect(store.bookmarks.map(b => b.id)).toEqual([2])
    expect(store.loading).toBe(false)
  })
})
