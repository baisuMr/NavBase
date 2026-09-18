import { api } from './index'

export const categoriesApi = {
  // 获取所有分类
  getAll: () => api.get('/categories'),

  // 获取单个分类
  getById: (id) => api.get(`/categories/${id}`),

  // 创建分类
  create: (data) => api.post('/categories', data),

  // 更新分类
  update: (id, data) => api.put(`/categories/${id}`, data),

  // 删除分类
  delete: (id) => api.delete(`/categories/${id}`)
}
