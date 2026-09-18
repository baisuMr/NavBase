import { api } from './index'

export const settingsApi = {
  // 获取站点设置
  get: () => api.get('/settings'),

  // 部分更新站点设置（site_name / avatar，传空串表示恢复默认）
  update: (data) => api.put('/settings', data)
}
