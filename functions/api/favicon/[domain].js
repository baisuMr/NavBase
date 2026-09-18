// GET /api/favicon/:domain - 获取网站图标
export async function onRequest(context) {
  const { params } = context;
  const { domain } = params;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle OPTIONS request
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (!domain) {
    return Response.json(
      { error: '域名不能为空' },
      { status: 400, headers }
    );
  }

  // 国内可用的favicon源
  const sources = [
    `https://favicon.im/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    `https://${domain}/favicon.ico`
  ];

  // 并发探测各源，取最先成功的一个（串行最坏 4×3s，并发上限 3s）
  const attempts = sources.map(async url => {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000) // 3秒超时
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return url;
  });

  try {
    const url = await Promise.any(attempts);
    return Response.json({ url }, { headers });
  } catch {
    // 所有源都失败，返回null
    return Response.json({ url: null }, { headers });
  }
}
