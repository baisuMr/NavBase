import { api } from './index'

export const bookmarksApi = {
  // 获取所有书签
  getAll: () => api.get('/bookmarks'),

  // 获取单个书签
  getById: (id) => api.get(`/bookmarks/${id}`),

  // 创建书签
  create: (data) => api.post('/bookmarks', data),

  // 更新书签
  update: (id, data) => api.put(`/bookmarks/${id}`, data),

  // 删除书签
  delete: (id) => api.delete(`/bookmarks/${id}`),

  // 批量导入书签
  importMany: (bookmarks) => api.post('/bookmarks/batch', { bookmarks })
}
