import { defineStore } from 'pinia'
import { bookmarksApi } from '../api/bookmarks'

export const useBookmarksStore = defineStore('bookmarks', {
  state: () => ({
    bookmarks: [],
    loading: false,
    error: null
  }),

  actions: {
    // 获取所有书签
    async fetchBookmarks() {
      this.loading = true
      this.error = null
      try {
        this.bookmarks = await bookmarksApi.getAll()
      } catch (error) {
        this.error = error.message
        console.error('Failed to fetch bookmarks:', error)
      } finally {
        this.loading = false
      }
    },

    // 创建书签
    async createBookmark(data) {
      const { id } = await bookmarksApi.create(data)
      await this.fetchBookmarks()
      return id
    },

    // 更新书签
    async updateBookmark(id, data) {
      await bookmarksApi.update(id, data)
      await this.fetchBookmarks()
    },

    // 固定/取消固定到首屏：翻转 is_pinned 并携带完整字段（PUT 全量替换，缺字段会清空描述等）
    async togglePin(bookmark) {
      await this.updateBookmark(bookmark.id, {
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
        category_id: bookmark.category_id,
        icon_url: bookmark.icon_url,
        is_pinned: bookmark.is_pinned ? 0 : 1
      })
    },

    // 删除书签
    async deleteBookmark(id) {
      await bookmarksApi.delete(id)
      await this.fetchBookmarks()
    },

    // 批量导入书签，返回 { count, skipped }（skipped 为重复跳过数）
    async importBookmarks(items) {
      const data = await bookmarksApi.importMany(items)
      await this.fetchBookmarks()
      return { count: data.count, skipped: data.skipped || 0 }
    }
  }
})
