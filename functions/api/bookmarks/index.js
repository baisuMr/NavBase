// GET /api/bookmarks - 获取所有书签
// POST /api/bookmarks - 创建书签
import { validateBookmarkPayload } from '../../utils/validate.js';

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
      const err = validateBookmarkPayload(data);
      if (err) {
        return Response.json({ error: err }, { status: 400, headers });
      }
      const { title, url, description, category_id, icon_url, sort_order } = data;

      const result = await env.DB.prepare(
        'INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        title.trim(),
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
