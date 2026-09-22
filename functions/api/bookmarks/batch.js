// POST /api/bookmarks/batch - 批量创建书签（用于导入）
// 说明：Pages Functions 静态路由优先于 [id] 动态路由，此文件不会与书签详情接口冲突
import { validateBookmarkPayload } from '../../utils/validate.js';

const MAX_BATCH_SIZE = 500;
const CHUNK_SIZE = 50;
// D1 单条语句 bind 参数上限为 100，留余量分块做 IN 查询
const QUERY_CHUNK_SIZE = 90;

// 供单元测试直接复用协议/字段校验逻辑
export function validateBookmark(item) {
  return validateBookmarkPayload(item);
}

// 按 url 字面值去重（保留首条）；比对库内已有书签，跳过重复
async function dedupe(env, items) {
  const seen = new Set();
  const batchUnique = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    batchUnique.push(item);
  }

  const existing = new Set();
  const urls = batchUnique.map(i => i.url);
  for (let i = 0; i < urls.length; i += QUERY_CHUNK_SIZE) {
    const slice = urls.slice(i, i + QUERY_CHUNK_SIZE);
    const placeholders = slice.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT url FROM bookmarks WHERE url IN (${placeholders})`
    ).bind(...slice).all();
    for (const row of results) existing.add(row.url);
  }

  return {
    toInsert: batchUnique.filter(i => !existing.has(i.url)),
    skipped: items.length - batchUnique.filter(i => !existing.has(i.url)).length
  };
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

    // 批内 + 库内双重去重，避免重复导入产生冗余书签
    const { toInsert, skipped } = await dedupe(env, items);

    // 新导入书签排最后：从库内 MAX(sort_order)+1 起按导入顺序递增
    let nextSort = 1;
    if (toInsert.length > 0) {
      const { max } = (await env.DB.prepare(
        'SELECT COALESCE(MAX(sort_order), 0) AS max FROM bookmarks'
      ).first()) ?? { max: 0 };
      nextSort = max + 1;
    }

    // D1 单次 batch 有语句数限制，分块提交
    let count = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      const stmts = chunk.map((item, j) =>
        env.DB.prepare(
          'INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          item.title.trim(),
          item.url,
          item.description || '',
          item.category_id || null,
          item.icon_url || '',
          nextSort + i + j
        )
      );
      await env.DB.batch(stmts);
      count += chunk.length;
    }

    return Response.json({ success: true, count, skipped }, { headers });
  } catch (error) {
    console.error('Batch import error:', error);
    return Response.json({ error: '服务器错误' }, { status: 500, headers });
  }
}
