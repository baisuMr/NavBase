import { api } from './index'

export const categoriesApi = {
  // 获取所有分类
  getAll: () => api.get('/categories'),

  // 创建分类
  create: (data) => api.post('/categories', data),

  // 更新分类
  update: (id, data) => api.put(`/categories/${id}`, data),

  // 重排分类（按传入 id 顺序重编 sort_order）
  sort: (ids) => api.put('/categories/sort', { ids }),

  // 删除分类
  delete: (id) => api.delete(`/categories/${id}`)
}
