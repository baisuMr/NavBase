import { useAuthStore } from '../stores/auth'

const BASE_URL = '/api'

// 清除登录状态并跳转到登录页（状态统一由 auth store 管理，避免两处各自维护 localStorage）
function redirectToLogin() {
  useAuthStore().clearAuth()
  window.location.href = '/login'
}

// 通用请求函数
async function request(url, options = {}) {
  const { headers = {}, ...rest } = options

  const response = await fetch(`${BASE_URL}${url}`, {
    ...rest,
    // headers 放在最后合并：调用方传入的自定义头不会覆盖认证与 Content-Type
    headers: {
      'Content-Type': 'application/json',
      ...useAuthStore().getAuthHeaders(),
      ...headers
    }
  })

  // 处理 401 错误
  if (response.status === 401) {
    redirectToLogin()
    throw new Error('未授权，请重新登录')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// API 对象
export const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => request(url, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (url) => request(url, { method: 'DELETE' })
}
