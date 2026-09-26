// favicon 持证 URL 的 k 派生（前端）：k 从登录 token 派生，不新增任何配置
// 算法契约（与 worker/utils/faviconKey.js 完全一致，双方测试向量锁定）：
//   k = base64url(sha256(utf8("navbase-favicon:v1\n" + token)))
import { ref } from 'vue'

const PREFIX = 'navbase-favicon:v1\n'

// ref 使 getFaviconKey() 在渲染期被读取时自动建立依赖，k 就绪后图标区自动重渲染
const keyRef = ref('')

export function getFaviconKey() {
  return keyRef.value
}

export async function initFaviconKey(token) {
  if (!token) {
    keyRef.value = ''
    return ''
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PREFIX + String(token)))
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const key = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  keyRef.value = key
  return key
}

export function clearFaviconKey() {
  keyRef.value = ''
}
