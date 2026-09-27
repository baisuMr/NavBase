import { api } from './index'

export const pageMetaApi = {
  // 抓取网页标题/描述（signal 供表单在 URL 变更时取消在途请求）
  get: (url, signal) => api.get(`/page-meta?url=${encodeURIComponent(url)}`, signal ? { signal } : undefined)
}
