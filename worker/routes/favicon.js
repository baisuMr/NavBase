import { isValidFaviconKey } from '../utils/faviconKey.js';

// GET /api/favicon/:domain - 代理并缓存网站图标
// <img> 标签无法携带 Basic Auth 头，此端点在认证门中放行、由处理器自验 ?k= 持证（详见 auth.js）；
// 域名由调用方提供、输出为公开网站图标，不含任何用户数据
const ALLOWED_DOMAIN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
export const MAX_ICON_BYTES = 512 * 1024; // 512KB 上限，拦截异常大文件（导出供测试断言流式截断阈值）
const CACHE_TTL = 604800; // 成功结果缓存 7 天（Cloudflare Cache API + 浏览器）
const MISS_TTL = 600; // 失败结果缓存 10 分钟，避免对不可达站点反复探测
const SOURCE_TIMEOUT = 3000; // 单源超时（毫秒）
const TOTAL_BUDGET_MS = 5000; // 整个请求的硬预算（含 body 读取），到点统一取消
const MAX_REDIRECTS = 3; // 手动跟随重定向上限
const MAX_HTML_CANDIDATES = 3; // HTML 图标声明最多尝试的候选数
const MAX_HTML_BYTES = 256 * 1024; // 首页 HTML 只读前 256KB（图标声明集中在 head 区）

// 所有 favicon 响应统一带安全头（响应进缓存后一并生效）：
// CSP sandbox 让响应即使被以文档方式打开也不透明源、脚本禁行；nosniff 防类型嗅探
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': 'sandbox'
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 图片魔数 → MIME 映射：不信任上游 content-type，输出类型只由字节头决定
const IMAGE_MAGIC = [
  { sig: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { sig: [0x47, 0x49, 0x46], mime: 'image/gif' },
  { sig: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { sig: [0x42, 0x4d], mime: 'image/bmp' },
  { sig: [0x00, 0x00, 0x01, 0x00], mime: 'image/x-icon' },
  { sig: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }
];

// 按魔数返回强制 MIME；不在白名单（含 SVG）返回 null 一律拒收
function mimeFromMagic(buffer) {
  const head = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
  const hit = IMAGE_MAGIC.find(({ sig }) => sig.every((byte, i) => head[i] === byte));
  return hit ? hit.mime : null;
}

/**
 * 手动跟随重定向的 fetch：
 *  - redirect: 'manual' 防上游把探测请求带到不可控目标（安全）
 *  - 仅允许 http/https 且最多 MAX_REDIRECTS 跳，兼容 http→https 升级等常见跳转
 *  - 支持外部 signal（竞速取消）与内部超时
 */
async function fetchWithRedirects(url, { signal, timeout, headers }) {
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
        const next = new URL(location, current);
        if (next.protocol !== 'http:' && next.protocol !== 'https:') {
          throw new Error('重定向到非 http(s) 协议');
        }
        // 跳转目标同样必须是合法域名格式：杜绝跳到内网 IP / localhost 等地址
        if (!ALLOWED_DOMAIN.test(next.hostname.toLowerCase())) {
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

// 把 abort 事件转成可与 reader.read() 竞速的 rejected promise（信号触发时让读取立即失败）
function abortPromise(signal) {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) return reject(new Error('已取消'));
    signal.addEventListener('abort', () => reject(new Error('已取消')), { once: true });
  });
}

// 流式读取响应体的前 maxBytes 字节并解码为文本（提前取消剩余流，避免超大页面整页读入）
async function readHtmlPrefix(res, maxBytes, signal) {
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await Promise.race([reader.read(), abortPromise(signal)]);
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const all = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

// 流式读取图片体，超过 maxBytes 立即取消（与 readHtmlPrefix 同思路：
// 不等整个响应下载完才检查，防止恶意源慢慢滴流拖住内存）
async function readImageBytes(res, maxBytes, signal) {
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    while (received <= maxBytes) {
      const { done, value } = await Promise.race([reader.read(), abortPromise(signal)]);
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (received === 0 || received > maxBytes) throw new Error('图片大小越界');
  const all = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return all.buffer;
}

// 从首页 HTML 提取 <link> 图标声明（rel 含 icon / apple-touch-icon）
function parseIconLinks(html) {
  const links = [];
  const tagRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (!/(^|\s)(shortcut\s+)?icon(\s|$)|apple-touch-icon/i.test(rel)) continue;
    const href = (tag.match(/\bhref\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (!href) continue;
    const sizes = (tag.match(/\bsizes\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    links.push({ href: href.replace(/&amp;/g, '&'), sizes, isApple: /apple/i.test(rel) });
  }
  return links;
}

// 候选排序：apple-touch-icon 优先（通常尺寸最大），同类按 sizes 最大边长降序，无声明按 32px 兜底
function candidateCompare(a, b) {
  if (a.isApple !== b.isApple) return a.isApple ? -1 : 1;
  const sizeOf = sizes => {
    const m = (sizes || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
    return m ? Math.max(parseInt(m[1], 10), parseInt(m[2], 10)) : 32;
  };
  return sizeOf(b.sizes) - sizeOf(a.sizes);
}

// 源 1：解析目标站首页 HTML 的图标声明（现代站点图标大多不在 /favicon.ico，此源显著提升成功率与清晰度）
async function probeHtmlIcon(domain, signal) {
  const pageUrl = `https://${domain}/`;
  const page = await fetchWithRedirects(pageUrl, { signal, timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': BROWSER_UA } });
  if (!page.ok) throw new Error(`首页 HTTP ${page.status}`);
  const contentType = (page.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType && !contentType.includes('html')) throw new Error('首页不是 HTML');
  const html = await readHtmlPrefix(page, MAX_HTML_BYTES, signal);

  const candidates = parseIconLinks(html).sort(candidateCompare).slice(0, MAX_HTML_CANDIDATES);
  for (const link of candidates) {
    let iconUrl;
    try {
      iconUrl = new URL(link.href, pageUrl).href;
    } catch {
      continue;
    }
    try {
      const res = await fetchWithRedirects(iconUrl, { signal, timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': BROWSER_UA } });
      if (!res.ok) continue;
      // 大小校验内聚在 readImageBytes：流式读取，超限立即断开
      const buffer = await readImageBytes(res, MAX_ICON_BYTES, signal);
      const mime = mimeFromMagic(buffer);
      if (!mime) continue;
      return { buffer, contentType: mime, source: iconUrl };
    } catch {
      continue;
    }
  }
  throw new Error('HTML 图标声明全部失败');
}

// 直链源：请求 URL 并做响应校验
async function probeUrl(url, signal) {
  const res = await fetchWithRedirects(url, { signal, timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // 大小校验内聚在 readImageBytes：流式读取，超限立即断开
  const buffer = await readImageBytes(res, MAX_ICON_BYTES, signal);
  const mime = mimeFromMagic(buffer);
  if (!mime) throw new Error('响应不是图片');
  return { buffer, contentType: mime, source: url };
}

// 并发竞速：所有源同时启动，第一个成功即 abort 其余在途请求（省出站请求与配额）；
// outerSignal 为总预算信号，触发时统一取消所有在途源并整体 reject
function raceProbes(factories, outerSignal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let remaining = factories.length;
    const aborts = [];
    // 统一的 settle 出口：先摘除外部 abort 监听，避免预算信号晚到再触发副作用
    const detach = () => {
      if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
    };
    const onOuterAbort = () => {
      for (const abort of aborts) abort();
      if (!settled) {
        settled = true;
        detach();
        reject(new Error('总预算耗尽'));
      }
    };
    if (outerSignal) {
      if (outerSignal.aborted) return onOuterAbort();
      outerSignal.addEventListener('abort', onOuterAbort, { once: true });
    }
    for (const factory of factories) {
      const ctl = new AbortController();
      aborts.push(() => ctl.abort());
      factory(ctl.signal).then(
        result => {
          if (settled) return;
          settled = true;
          detach();
          for (const abort of aborts) abort();
          resolve(result);
        },
        () => {
          remaining -= 1;
          if (remaining === 0 && !settled) {
            settled = true;
            detach();
            reject(new Error('全部源失败'));
          }
        }
      );
    }
  });
}

export async function handle(request, env, params, ctx) {
  const domain = String(params.domain || '').toLowerCase();

  if (request.method !== 'GET') {
    return Response.json({ error: '请求方法不支持', code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: SECURITY_HEADERS });
  }

  // 持证校验：k 由登录凭据派生（详见 src/utils/faviconKey.js），未持证不进入任何探测
  if (!env.ADMIN_PASSWORD) {
    return Response.json(
      { error: '服务器未配置 ADMIN_PASSWORD', code: 'NOT_CONFIGURED' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
  const k = new URL(request.url).searchParams.get('k');
  if (!(await isValidFaviconKey(k, env))) {
    return Response.json(
      { error: '未授权访问', code: 'UNAUTHORIZED' },
      { status: 401, headers: SECURITY_HEADERS }
    );
  }

  // 域名格式校验：只放行合法 hostname，杜绝把路径/凭据拼进上游 URL（SSRF）
  if (!domain || domain.length > 253 || !ALLOWED_DOMAIN.test(domain)) {
    return Response.json({ error: '域名格式不合法', code: 'VALIDATION_ERROR' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Cache API：本地 wrangler dev 与线上均可用，同一图标只探测一次
  const cache = caches.default;
  // 键带版本号：响应头策略变更（类型强制/nosniff）时换版本即可让旧缓存条目整体失效
  const cacheKey = new Request(`https://favicon-cache.local/v3/${domain}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // 并发探测各源，取最先返回有效图片的一个（单源 3 秒超时，总耗时上限 5 秒，含 body 读取）：
  // 1. 目标站首页 HTML 图标声明（清晰度与覆盖率最优）
  // 2. 目标站 /favicon.ico 直连
  // 3-5. favicon.im / DuckDuckGo / Google s2（Cloudflare 边缘可达性好，兜底互补）
  const factories = [
    signal => probeHtmlIcon(domain, signal),
    signal => probeUrl(`https://${domain}/favicon.ico`, signal),
    signal => probeUrl(`https://favicon.im/${domain}`, signal),
    signal => probeUrl(`https://icons.duckduckgo.com/ip3/${domain}.ico`, signal),
    signal => probeUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`, signal)
  ];

  // 总预算定时器：到点 abort 全部在途探测（含 body 流式读取），防止该端点被滴流拖住
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), TOTAL_BUDGET_MS);
  try {
    const result = await raceProbes(factories, budget.signal);
    const response = new Response(result.buffer, {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': result.contentType,
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Favicon-Source': result.source
      }
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    // 全部源失败（含总预算耗尽）：200 空体而非 404——
    // 浏览器对失败子资源必打控制台日志且无法抑制，200 空体使 <img> 触发 error 事件、
    // 前端回退首字头像且控制台干净（负面缓存 10 分钟，与前端 FAILED_TTL 对齐）
    const miss = new Response(null, {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${MISS_TTL}`
      }
    });
    ctx.waitUntil(cache.put(cacheKey, miss.clone()));
    return miss;
  } finally {
    clearTimeout(budgetTimer);
  }
}
