// GET /api/categories - 获取所有分类
// POST /api/categories - 创建分类
import { validateCategoryPayload } from '../../utils/validate.js';

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
    // GET - 获取所有分类
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM categories ORDER BY sort_order, id'
      ).all();

      return Response.json(results, { headers });
    }

    // POST - 创建分类
    if (request.method === 'POST') {
      const data = await request.json();
      const err = validateCategoryPayload(data);
      if (err) {
        return Response.json({ error: err }, { status: 400, headers });
      }
      const { name, icon, color } = data;

      // sort_order 取 MAX+1：新分类固定排最后，忽略传入值
      const result = await env.DB.prepare(
        'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))'
      ).bind(name.trim(), icon || 'ri-folder-line', color || '#10b981').run();

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
    console.error('Categories API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500, headers }
    );
  }
}
