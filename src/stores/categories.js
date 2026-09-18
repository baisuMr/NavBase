import { defineStore } from 'pinia'
import { categoriesApi } from '../api/categories'

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categories: [],
    loading: false,
    error: null
  }),

  actions: {
    // 获取所有分类
    async fetchCategories() {
      this.loading = true
      this.error = null
      try {
        this.categories = await categoriesApi.getAll()
      } catch (error) {
        this.error = error.message
        console.error('Failed to fetch categories:', error)
      } finally {
        this.loading = false
      }
    },

    // 创建分类
    async createCategory(data) {
      const { id } = await categoriesApi.create(data)
      await this.fetchCategories()
      return id
    },

    // 更新分类
    async updateCategory(id, data) {
      await categoriesApi.update(id, data)
      await this.fetchCategories()
    },

    // 删除分类
    async deleteCategory(id) {
      await categoriesApi.delete(id)
      await this.fetchCategories()
    }
  }
})
