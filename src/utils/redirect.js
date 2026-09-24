// 登录后回跳地址校验：仅允许站内绝对路径，防开放重定向
export function safeRedirectPath(value) {
  if (typeof value !== 'string') return '/'
  // 必须以单个 / 开头：拦 //evil.com（协议相对）与 https://evil.com（绝对 URL）
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
