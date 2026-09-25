import { useAuthStore } from '../stores/auth'

const BASE_URL = '/api'
// 弱网兜底：请求超过 15 秒即中止，避免「保存中…」等状态永久悬挂
const REQUEST_TIMEOUT_MS = 15000
const TIMEOUT_MESSAGE = '请求超时，请检查网络后重试'

// 清除登录状态并跳转到登录页（状态统一由 auth store 管理，避免两处各自维护 localStorage）
function redirectToLogin() {
  useAuthStore().clearAuth()
  // 携带来源地址：登录后按 safeRedirectPath 校验回跳原页
  const from = window.location.pathname + window.location.search
  window.location.href = '/login?redirect=' + encodeURIComponent(from)
}

// 通用请求函数
async function request(url, options = {}) {
  const { headers = {}, ...rest } = options

  let response
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      ...rest,
      // headers 放在最后合并：调用方传入的自定义头不会覆盖认证与 Content-Type；
      // signal 兜底 15 秒超时，调用方自带 signal 时以调用方为准
      signal: rest.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        ...useAuthStore().getAuthHeaders(),
        ...headers
      }
    })
  } catch (error) {
    // AbortSignal.timeout 中止时抛 TimeoutError，转成用户可读文案
    if (error && error.name === 'TimeoutError') throw new Error(TIMEOUT_MESSAGE)
    throw error
  }

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
