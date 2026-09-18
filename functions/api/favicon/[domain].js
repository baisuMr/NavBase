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

  // 依次尝试各个源
  for (const url of sources) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000) // 3秒超时
      });

      if (response.ok) {
        return Response.json({ url }, { headers });
      }
    } catch {
      // 继续尝试下一个源
      continue;
    }
  }

  // 所有源都失败，返回null
  return Response.json({ url: null }, { headers });
}
