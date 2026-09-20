// GET /api/favicon/:domain - 代理并缓存网站图标
// <img> 标签无法携带 Basic Auth 头，此端点在中间件中免认证放行；
// 域名由调用方提供、输出为公开网站图标，不含任何用户数据
const ALLOWED_DOMAIN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const MAX_ICON_BYTES = 512 * 1024; // 512KB 上限，拦截异常大文件
const CACHE_TTL = 604800; // 成功结果缓存 7 天（Cloudflare Cache API + 浏览器）
const MISS_TTL = 600; // 失败结果缓存 10 分钟，避免对不可达站点反复探测

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

export async function onRequest(context) {
  const { params, request } = context;
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

  // 并发探测各源，取最先返回有效图片的一个（单源 3 秒超时，总耗时上限 3 秒）
  // 目标站直连在本地/国内网络可达性最好；favicon.im / DuckDuckGo / Google s2
  // 在 Cloudflare 边缘（线上）可达性最好，四源互补
  const sources = [
    `https://${domain}/favicon.ico`,
    `https://favicon.im/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  ];

  const attempts = sources.map(async url => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: {
        // 部分站点（如 zhihu）对空 UA 返回 403，用浏览器 UA 提高命中率
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_ICON_BYTES) throw new Error('图片大小越界');
    if (!looksLikeImage(buffer, (response.headers.get('content-type') || '').split(';')[0].trim())) {
      throw new Error('响应不是图片');
    }
    return new Response(buffer, {
      headers: {
        'Content-Type': (response.headers.get('content-type') || 'image/x-icon').split(';')[0].trim(),
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Favicon-Source': url,
        'Access-Control-Allow-Origin': '*'
      }
    });
  });

  try {
    const response = await Promise.any(attempts);
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    // 全部源失败：负面缓存 10 分钟，浏览器端也缓存，避免反复探测拖慢页面
    const miss = new Response(null, {
      status: 404,
      headers: { 'Cache-Control': `public, max-age=${MISS_TTL}`, 'Access-Control-Allow-Origin': '*' }
    });
    context.waitUntil(cache.put(cacheKey, miss.clone()));
    return miss;
  }
}
