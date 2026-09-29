// favicon 代理 URL 的查询参数状态（持证 k + 缓存世代 v）
// k 从登录 token 派生，不新增任何配置；
// 算法契约（与 worker/utils/faviconKey.js 完全一致，双方测试向量锁定）：
//   k = base64url(sha256(utf8("navbase-favicon:v1\n" + token)))
// v 为图标缓存世代（站点设置 favicon_cache_ver）：换代即浏览器/服务端缓存整体作废，
// 「清除图标缓存」按钮通过它立即刷新所有图标
import { ref } from 'vue'

const PREFIX = 'navbase-favicon:v1\n'

// ref 使 getFaviconKey()/getFaviconCacheVer() 在渲染期被读取时自动建立依赖，就绪/换代后图标区自动重渲染
const keyRef = ref('')
const verRef = ref(1)

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

export function getFaviconCacheVer() {
  return verRef.value
}

// 世代号只接受正整数，非法值归一默认 1（与 worker 端缓存键口径一致）
export function setFaviconCacheVer(v) {
  const n = Number(v)
  verRef.value = Number.isInteger(n) && n > 0 ? n : 1
}
