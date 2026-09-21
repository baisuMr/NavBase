// GET /api/categories/:id - 获取单个分类
// PUT /api/categories/:id - 更新分类
// DELETE /api/categories/:id - 删除分类
import { validateCategoryPayload } from '../../utils/validate.js';

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
    // GET - 获取单个分类
    if (request.method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first();

      if (!result) {
        return Response.json(
          { error: '分类不存在' },
          { status: 404, headers }
        );
      }

      return Response.json(result, { headers });
    }

    // PUT - 更新分类
    if (request.method === 'PUT') {
      const data = await request.json();
      const err = validateCategoryPayload(data);
      if (err) {
        return Response.json({ error: err }, { status: 400, headers });
      }
      const { name, icon, color, sort_order } = data;

      // 检查分类是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM categories WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return Response.json(
          { error: '分类不存在' },
          { status: 404, headers }
        );
      }

      await env.DB.prepare(
        'UPDATE categories SET name = ?, icon = ?, color = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(name.trim(), icon || 'ri-folder-line', color || '#10b981', sort_order || 0, id).run();

      return Response.json({ success: true }, { headers });
    }

    // DELETE - 删除分类
    if (request.method === 'DELETE') {
      // 检查分类是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM categories WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return Response.json(
          { error: '分类不存在' },
          { status: 404, headers }
        );
      }

      // 将该分类下的书签的 category_id 设为 null
      await env.DB.prepare(
        'UPDATE bookmarks SET category_id = NULL WHERE category_id = ?'
      ).bind(id).run();

      // 删除分类
      await env.DB.prepare(
        'DELETE FROM categories WHERE id = ?'
      ).bind(id).run();

      return Response.json({ success: true }, { headers });
    }

    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers }
    );
  } catch (error) {
    console.error('Category API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500, headers }
    );
  }
}
