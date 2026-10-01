// 手动跟随重定向的 fetch（favicon / pageMeta 共用）：
//  - redirect: 'manual' 防上游把请求带到不可控目标（安全）
//  - 仅允许 http/https 且最多 MAX_REDIRECTS 跳，兼容 http→https 升级等常见跳转
//  - 跳转目标同样必须是合法公网域名（与首跳同口径），杜绝跳到内网 IP / localhost 等地址
//  - 支持外部 signal（竞速取消）与内部超时
import { isAllowedDomain } from './domain.js';

const MAX_REDIRECTS = 3; // 手动跟随重定向上限

export async function fetchWithRedirects(url, { signal, timeout, headers }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  const onOuterAbort = () => ctl.abort();
  if (signal) signal.addEventListener('abort', onOuterAbort, { once: true });
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, { redirect: 'manual', signal: ctl.signal, headers });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return res;
        let next;
        try {
          next = new URL(location, current);
        } catch {
          throw new Error('重定向地址非法');
        }
        if (next.protocol !== 'http:' && next.protocol !== 'https:') {
          throw new Error('重定向到非 http(s) 协议');
        }
        if (!isAllowedDomain(next.hostname.toLowerCase())) {
          throw new Error('重定向到非法域名');
        }
        current = next.href;
        continue;
      }
      return res;
    }
    throw new Error('重定向次数过多');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onOuterAbort);
  }
}
