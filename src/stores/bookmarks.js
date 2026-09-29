import { defineStore } from 'pinia'
import { bookmarksApi } from '../api/bookmarks'

export const useBookmarksStore = defineStore('bookmarks', {
  state: () => ({
    bookmarks: [],
    loading: false,
    error: null,
    fetchSeq: 0 // 请求序号：并发拉取时只认最后一次请求的结果
  }),

  actions: {
    // 获取所有书签
    async fetchBookmarks() {
      const seq = ++this.fetchSeq
      this.loading = true
      this.error = null
      try {
        const data = await bookmarksApi.getAll()
        if (seq !== this.fetchSeq) return // 已有更新的请求，丢弃过期响应
        this.bookmarks = data
      } catch (error) {
        if (seq !== this.fetchSeq) return // 过期请求的失败不影响当前状态
        this.error = error.message
        console.error('Failed to fetch bookmarks:', error)
      } finally {
        if (seq === this.fetchSeq) this.loading = false // 仅最新请求复位 loading
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
        is_pinned: bookmark.is_pinned ? 0 : 1
      })
    },

    // 删除书签
    async deleteBookmark(id) {
      await bookmarksApi.delete(id)
      await this.fetchBookmarks()
    },

    // 重排书签（分类内）：乐观本地换位（与服务端同语义：sort_order 数值集合不变），失败回滚并重新拉取
    // 返回 true/false 供视图层提示用户
    async reorderBookmarks(ids) {
      const prev = this.bookmarks
      const items = ids.map((id) => prev.find((b) => b.id === id)).filter(Boolean)
      const values = items.map((b) => b.sort_order).sort((a, b) => a - b)
      const valueById = new Map(items.map((b, i) => [b.id, values[i]]))
      // 排序键与服务端一致（sort_order, id），保证乐观顺序与重拉后一致
      this.bookmarks = prev
        .map((b) => (valueById.has(b.id) ? { ...b, sort_order: valueById.get(b.id) } : b))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      try {
        await bookmarksApi.sort(ids)
        return true
      } catch (error) {
        console.error('Failed to reorder bookmarks:', error)
        await this.fetchBookmarks()
        return false
      }
    },

    // 批量导入书签，返回 { count, skipped }（skipped 为重复跳过数）
    // refresh=false 供分块导入循环调用（全部提交完由调用方统一 fetchBookmarks）
    async importBookmarks(items, refresh = true) {
      const data = await bookmarksApi.importMany(items)
      if (refresh) await this.fetchBookmarks()
      return { count: data.count, skipped: data.skipped || 0 }
    }
  }
})
