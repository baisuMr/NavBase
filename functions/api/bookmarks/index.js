// GET /api/bookmarks - 获取所有书签
// POST /api/bookmarks - 创建书签
export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // GET - 获取所有书签
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        ORDER BY b.sort_order, b.id
      `).all();

      return Response.json(results, { headers });
    }

    // POST - 创建书签
    if (request.method === 'POST') {
      const data = await request.json();
      const { title, url, description, category_id, icon_url, sort_order } = data;

      if (!title || !url) {
        return Response.json(
          { error: '标题和URL不能为空' },
          { status: 400, headers }
        );
      }

      // 验证URL格式，仅允许 http/https（拦截 javascript:、data: 等协议）
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return Response.json(
          { error: 'URL格式不正确' },
          { status: 400, headers }
        );
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return Response.json(
          { error: '仅支持 http/https 链接' },
          { status: 400, headers }
        );
      }

      const result = await env.DB.prepare(
        'INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        title,
        url,
        description || '',
        category_id || null,
        icon_url || '',
        sort_order || 0
      ).run();

      return Response.json(
        { id: result.meta.last_row_id, success: true },
        { status: 201, headers }
      );
    }

    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers }
    );
  } catch (error) {
    console.error('Bookmarks API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500, headers }
    );
  }
}
