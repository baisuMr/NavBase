// GET /api/favicon/:domain - 代理并缓存网站图标
// <img> 标签无法携带 Basic Auth 头，此端点在认证门中免认证放行；
// 域名由调用方提供、输出为公开网站图标，不含任何用户数据
const ALLOWED_DOMAIN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const MAX_ICON_BYTES = 512 * 1024; // 512KB 上限，拦截异常大文件
const CACHE_TTL = 604800; // 成功结果缓存 7 天（Cloudflare Cache API + 浏览器）
const MISS_TTL = 600; // 失败结果缓存 10 分钟，避免对不可达站点反复探测
const SOURCE_TIMEOUT = 3000; // 单源超时（毫秒）
const MAX_REDIRECTS = 3; // 手动跟随重定向上限
const MAX_HTML_CANDIDATES = 3; // HTML 图标声明最多尝试的候选数
const MAX_HTML_BYTES = 256 * 1024; // 首页 HTML 只读前 256KB（图标声明集中在 head 区）

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 图片魔数白名单：不信任上游 content-type，按字节头确认是图片
const IMAGE_MAGIC = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0x47, 0x49, 0x46], // GIF
  [0xff, 0xd8, 0xff], // JPEG
  [0x42, 0x4d], // BMP
  [0x00, 0x00, 0x01, 0x00], // ICO
  [0x52, 0x49, 0x46, 0x46] // RIFF（WebP 容器头）
];

function looksLikeImage(buffer, contentType) {
  if (contentType === 'image/svg+xml') return true;
  const head = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
  if (IMAGE_MAGIC.some(sig => sig.every((byte, i) => head[i] === byte))) return true;
  // SVG 可能带 XML 声明头，魔数覆盖不到，按文本探测
  const text = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength))).toLowerCase();
  return text.includes('<svg');
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

// 流式读取响应体的前 maxBytes 字节并解码为文本（提前取消剩余流，避免超大页面整页读入）
async function readHtmlPrefix(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
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
  const html = await readHtmlPrefix(page, MAX_HTML_BYTES);

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
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_ICON_BYTES) continue;
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (!looksLikeImage(buffer, ct)) continue;
      return { buffer, contentType: ct || 'image/x-icon', source: iconUrl };
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
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_ICON_BYTES) throw new Error('图片大小越界');
  const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!looksLikeImage(buffer, ct)) throw new Error('响应不是图片');
  return { buffer, contentType: ct || 'image/x-icon', source: url };
}

// 并发竞速：所有源同时启动，第一个成功即 abort 其余在途请求（省出站请求与配额）
function raceProbes(factories) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let remaining = factories.length;
    const aborts = [];
    for (const factory of factories) {
      const ctl = new AbortController();
      aborts.push(() => ctl.abort());
      factory(ctl.signal).then(
        result => {
          if (settled) return;
          settled = true;
          for (const abort of aborts) abort();
          resolve(result);
        },
        () => {
          remaining -= 1;
          if (remaining === 0 && !settled) reject(new Error('全部源失败'));
        }
      );
    }
  });
}

export async function handle(request, env, params, ctx) {
  const domain = String(params.domain || '').toLowerCase();

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }
  if (request.method !== 'GET') {
    return Response.json({ error: '仅支持 GET' }, { status: 405, headers });
  }

  // 域名格式校验：只放行合法 hostname，杜绝把路径/凭据拼进上游 URL（SSRF）
  if (!domain || domain.length > 253 || !ALLOWED_DOMAIN.test(domain)) {
    return Response.json({ error: '域名格式不合法' }, { status: 400, headers });
  }

  // Cache API：本地 wrangler dev 与线上均可用，同一图标只探测一次
  const cache = caches.default;
  const cacheKey = new Request(`https://favicon-cache.local/${domain}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // 并发探测各源，取最先返回有效图片的一个（单源 3 秒超时，总耗时上限 3 秒）：
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

  try {
    const result = await raceProbes(factories);
    const response = new Response(result.buffer, {
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Favicon-Source': result.source,
        'Access-Control-Allow-Origin': '*'
      }
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    // 全部源失败：负面缓存 10 分钟，浏览器端也缓存，避免反复探测拖慢页面
    const miss = new Response(null, {
      status: 404,
      headers: { 'Cache-Control': `public, max-age=${MISS_TTL}`, 'Access-Control-Allow-Origin': '*' }
    });
    ctx.waitUntil(cache.put(cacheKey, miss.clone()));
    return miss;
  }
}
