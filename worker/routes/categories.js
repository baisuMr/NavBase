// /api/categories* 分类端点
// 集合 GET/POST、详情 GET/PUT/DELETE、重排 PUT /api/categories/sort
// 字面量 sort 路由先于 :id 匹配（见 index.js 路由表顺序），与历史 Pages Functions 优先级一致
import { validateCategoryPayload } from '../utils/validate.js';
import { errorResponse } from '../utils/http.js';

// GET /api/categories - 获取所有分类
// POST /api/categories - 创建分类
export async function collection(request, env) {
  try {
    // GET - 获取所有分类
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM categories ORDER BY sort_order, id'
      ).all();

      return Response.json(results);
    }

    // POST - 创建分类
    if (request.method === 'POST') {
      const data = await request.json();
      const err = validateCategoryPayload(data);
      if (err) {
        return errorResponse(err, 'VALIDATION_ERROR', 400);
      }
      const { name, icon, color } = data;

      // sort_order 取 MAX+1：新分类固定排最后，忽略传入值
      const result = await env.DB.prepare(
        'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))'
      ).bind(name.trim(), icon || 'ri-folder-line', color || '#10b981').run();

      return Response.json(
        { id: result.meta.last_row_id, success: true },
        { status: 201 }
      );
    }

    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  } catch (error) {
    console.error('Categories API error:', error);
    return errorResponse('服务器错误', 'INTERNAL_ERROR', 500);
  }
}

// GET /api/categories/:id - 获取单个分类
// PUT /api/categories/:id - 更新分类
// DELETE /api/categories/:id - 删除分类
export async function item(request, env, params) {
  const { id } = params;

  try {
    // GET - 获取单个分类
    if (request.method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first();

      if (!result) {
        return errorResponse('分类不存在', 'NOT_FOUND', 404);
      }

      return Response.json(result);
    }

    // PUT - 更新分类
    if (request.method === 'PUT') {
      const data = await request.json();
      const err = validateCategoryPayload(data);
      if (err) {
        return errorResponse(err, 'VALIDATION_ERROR', 400);
      }
      const { name, icon, color } = data;

      // 检查分类是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM categories WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return errorResponse('分类不存在', 'NOT_FOUND', 404);
      }

      // 不更新 sort_order：编辑保留原排序
      await env.DB.prepare(
        'UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(name.trim(), icon || 'ri-folder-line', color || '#10b981', id).run();

      return Response.json({ success: true });
    }

    // DELETE - 删除分类
    if (request.method === 'DELETE') {
      // 检查分类是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM categories WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return errorResponse('分类不存在', 'NOT_FOUND', 404);
      }

      // 置空书签 + 删除分类经 batch 原子执行，避免中途失败留下半删状态
      await env.DB.batch([
        env.DB.prepare('UPDATE bookmarks SET category_id = NULL WHERE category_id = ?').bind(id),
        env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id)
      ]);

      return Response.json({ success: true });
    }

    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  } catch (error) {
    console.error('Category API error:', error);
    return errorResponse('服务器错误', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/categories/sort - 按传入顺序重排分类（重编 sort_order 为 1..n）
// 与 PUT /api/categories/:id 分工：编辑分类不改排序，重排只走本端点
export async function sort(request, env) {
  if (request.method !== 'PUT') {
    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const data = await request.json();
    const ids = data?.ids;

    // 形态校验：非空数组、均为正整数、无重复
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      !ids.every((id) => Number.isInteger(id) && id > 0) ||
      new Set(ids).size !== ids.length
    ) {
      return errorResponse('排序字段不正确', 'VALIDATION_ERROR', 400);
    }

    // 集合校验：ids 须与库内现有分类完全一致（防丢分类/幻影 id）
    const { results } = await env.DB.prepare('SELECT id FROM categories').all();
    const existing = new Set(results.map((r) => r.id));
    if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) {
      return errorResponse('排序列表与现有分类不一致', 'VALIDATION_ERROR', 400);
    }

    // batch 事务式重编号
    const stmts = ids.map((id, i) =>
      env.DB.prepare('UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(i + 1, id)
    );
    await env.DB.batch(stmts);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Category sort API error:', error);
    return errorResponse('服务器错误', 'INTERNAL_ERROR', 500);
  }
}
