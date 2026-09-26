// worker/utils/faviconKey.js
// favicon 持证 URL 的 k 派生与校验（服务端）
// 算法契约（与 src/utils/faviconKey.js 完全一致，双方测试向量锁定）：
//   k = base64url(sha256(utf8("navbase-favicon:v1\n" + token)))
import { secureCompare } from '../auth.js';
import { expectedToken } from './token.js';

const PREFIX = 'navbase-favicon:v1\n';

export async function deriveFaviconKey(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PREFIX + String(token)));
  const bytes = new Uint8Array(digest);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 校验入参 k 是否为 env 凭据派生的 k（常数时间比较，防时序侧信道）
export async function isValidFaviconKey(k, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const expected = await deriveFaviconKey(expectedToken(env));
  return secureCompare(String(k ?? ''), expected);
}
