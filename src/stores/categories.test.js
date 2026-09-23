// @vitest-environment happy-dom
// 分类 store 重排：乐观更新 + 成功/失败返回值（供视图层提示用户）
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn(),
    sort: vi.fn()
  }
}))

import { categoriesApi } from '../api/categories'
import { useCategoriesStore } from './categories'

const CATS = [{ id: 1 }, { id: 2 }, { id: 3 }]

describe('categories store 重排', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('重排成功返回 true，本地顺序按 ids 更新且重编 sort_order', async () => {
    categoriesApi.getAll.mockResolvedValue(CATS)
    categoriesApi.sort.mockResolvedValue({ success: true })
    const store = useCategoriesStore()
    await store.fetchCategories()

    const ok = await store.reorderCategories([3, 2, 1])

    expect(ok).toBe(true)
    expect(store.categories.map((c) => c.id)).toEqual([3, 2, 1])
    expect(store.categories.map((c) => c.sort_order)).toEqual([1, 2, 3])
    expect(categoriesApi.sort).toHaveBeenCalledWith([3, 2, 1])
  })

  it('重排失败返回 false 并回滚重新拉取服务端顺序', async () => {
    categoriesApi.getAll.mockResolvedValue(CATS)
    categoriesApi.sort.mockRejectedValue(new Error('网络错误'))
    const store = useCategoriesStore()
    await store.fetchCategories()

    const ok = await store.reorderCategories([3, 2, 1])

    expect(ok).toBe(false)
    expect(categoriesApi.getAll).toHaveBeenCalledTimes(2) // 初始加载 + 失败回滚
    expect(store.categories.map((c) => c.id)).toEqual([1, 2, 3])
  })
})
