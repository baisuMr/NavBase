// GET /api/bookmarks/:id - 获取单个书签
// PUT /api/bookmarks/:id - 更新书签
// DELETE /api/bookmarks/:id - 删除书签
import { validateBookmarkPayload } from '../../utils/validate.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const { id } = params;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // GET - 获取单个书签
    if (request.method === 'GET') {
      const result = await env.DB.prepare(`
        SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.id = ?
      `).bind(id).first();

      if (!result) {
        return Response.json(
          { error: '书签不存在' },
          { status: 404, headers }
        );
      }

      return Response.json(result, { headers });
    }

    // PUT - 更新书签
    if (request.method === 'PUT') {
      const data = await request.json();
      const err = validateBookmarkPayload(data);
      if (err) {
        return Response.json({ error: err }, { status: 400, headers });
      }
      const { title, url, description, category_id, icon_url, sort_order } = data;

      // 检查书签是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM bookmarks WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return Response.json(
          { error: '书签不存在' },
          { status: 404, headers }
        );
      }

      await env.DB.prepare(
        'UPDATE bookmarks SET title = ?, url = ?, description = ?, category_id = ?, icon_url = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(
        title.trim(),
        url,
        description || '',
        category_id || null,
        icon_url || '',
        sort_order || 0,
        id
      ).run();

      return Response.json({ success: true }, { headers });
    }

    // DELETE - 删除书签
    if (request.method === 'DELETE') {
      // 检查书签是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM bookmarks WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return Response.json(
          { error: '书签不存在' },
          { status: 404, headers }
        );
      }

      await env.DB.prepare(
        'DELETE FROM bookmarks WHERE id = ?'
      ).bind(id).run();

      return Response.json({ success: true }, { headers });
    }

    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers }
    );
  } catch (error) {
    console.error('Bookmark API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500, headers }
    );
  }
}
