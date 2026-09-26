import { defineStore } from 'pinia'
import { categoriesApi } from '../api/categories'

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categories: [],
    error: null,
    fetchSeq: 0 // 请求序号：并发拉取时只认最后一次请求的结果
  }),

  actions: {
    // 获取所有分类
    async fetchCategories() {
      const seq = ++this.fetchSeq
      this.error = null
      try {
        const data = await categoriesApi.getAll()
        if (seq !== this.fetchSeq) return // 已有更新的请求，丢弃过期响应
        this.categories = data
      } catch (error) {
        if (seq !== this.fetchSeq) return // 过期请求的失败不影响当前状态
        this.error = error.message
        console.error('Failed to fetch categories:', error)
      }
    },

    // 创建分类；refresh=false 供批量场景循环调用（结束后由调用方统一 fetchCategories）
    async createCategory(data, refresh = true) {
      const { id } = await categoriesApi.create(data)
      if (refresh) await this.fetchCategories()
      return id
    },

    // 更新分类
    async updateCategory(id, data) {
      await categoriesApi.update(id, data)
      await this.fetchCategories()
    },

    // 重排分类：乐观本地重排，失败回滚并重新拉取。返回 true/false 供视图层提示用户
    async reorderCategories(ids) {
      const prev = this.categories
      this.categories = ids
        .map((id, i) => {
          const cat = prev.find((c) => c.id === id)
          return cat ? { ...cat, sort_order: i + 1 } : null
        })
        .filter(Boolean)
      try {
        await categoriesApi.sort(ids)
        return true
      } catch (error) {
        console.error('Failed to reorder categories:', error)
        await this.fetchCategories()
        return false
      }
    },

    // 删除分类
    async deleteCategory(id) {
      await categoriesApi.delete(id)
      await this.fetchCategories()
    }
  }
})
