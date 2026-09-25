/**
 * 书签 URL 协议白名单（前后端共同校验的前端部分，后端在 worker/utils/validate.js）
 * 仅允许 http/https：拦截 javascript:、data: 等危险协议（原生 type="url" 校验不拦协议）
 */
export function isAllowedUrl(val) {
  return /^https?:\/\//i.test((val || '').trim())
}
