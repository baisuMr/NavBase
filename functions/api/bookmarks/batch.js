// POST /api/bookmarks/batch - 批量创建书签（用于导入）
// 说明：Pages Functions 静态路由优先于 [id] 动态路由，此文件不会与书签详情接口冲突
const MAX_BATCH_SIZE = 500;
const CHUNK_SIZE = 50;

function validateBookmark(item) {
  if (!item || !item.title || !item.url) return '标题和URL不能为空';
  let parsed;
  try {
    parsed = new URL(item.url);
  } catch {
    return 'URL格式不正确';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '仅支持 http/https 链接';
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  }

  try {
    const data = await request.json();
    const items = Array.isArray(data?.bookmarks) ? data.bookmarks : [];

    if (items.length === 0) {
      return Response.json({ error: 'bookmarks 不能为空' }, { status: 400, headers });
    }
    if (items.length > MAX_BATCH_SIZE) {
      return Response.json({ error: `单次最多导入 ${MAX_BATCH_SIZE} 条` }, { status: 400, headers });
    }

    for (const item of items) {
      const err = validateBookmark(item);
      if (err) {
        return Response.json({ error: `${err}: ${item?.url || ''}` }, { status: 400, headers });
      }
    }

    // D1 单次 batch 有语句数限制，分块提交
    let count = 0;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const stmts = chunk.map(item =>
        env.DB.prepare(
          'INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          item.title,
          item.url,
          item.description || '',
          item.category_id || null,
          item.icon_url || '',
          0
        )
      );
      await env.DB.batch(stmts);
      count += chunk.length;
    }

    return Response.json({ success: true, count }, { headers });
  } catch (error) {
    console.error('Batch import error:', error);
    return Response.json({ error: '服务器错误' }, { status: 500, headers });
  }
}
