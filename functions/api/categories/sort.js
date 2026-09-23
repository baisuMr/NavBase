// PUT /api/categories/sort - 按传入顺序重排分类（重编 sort_order 为 1..n）
// 与 PUT /api/categories/:id 分工：编辑分类不改排序，重排只走本端点
export async function onRequest(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'PUT') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
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
      return Response.json({ error: '排序字段不正确' }, { status: 400, headers });
    }

    // 集合校验：ids 须与库内现有分类完全一致（防丢分类/幻影 id）
    const { results } = await env.DB.prepare('SELECT id FROM categories').all();
    const existing = new Set(results.map((r) => r.id));
    if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) {
      return Response.json({ error: '排序列表与现有分类不一致' }, { status: 400, headers });
    }

    // batch 事务式重编号
    const stmts = ids.map((id, i) =>
      env.DB.prepare('UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(i + 1, id)
    );
    await env.DB.batch(stmts);

    return Response.json({ success: true }, { headers });
  } catch (error) {
    console.error('Category sort API error:', error);
    return Response.json({ error: '服务器错误' }, { status: 500, headers });
  }
}
