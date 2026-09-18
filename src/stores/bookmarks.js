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
