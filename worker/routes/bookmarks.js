// /api/bookmarks* 书签端点
// 集合 GET/POST、详情 GET/PUT/DELETE、批量导入 POST /api/bookmarks/batch
// 字面量 batch 路由先于 :id 匹配（见 index.js 路由表顺序），与历史 Pages Functions 优先级一致
import { validateBookmarkPayload } from '../utils/validate.js';
import { errorResponse } from '../utils/http.js';

const MAX_BATCH_SIZE = 500;
const CHUNK_SIZE = 50;
// D1 单条语句 bind 参数上限为 100，留余量分块做 IN 查询
const QUERY_CHUNK_SIZE = 90;
// 首屏常用站点固定上限（与前端 src/utils/pinned.js 的 MAX_PINNED 保持一致）
const MAX_PINNED = 10;

// 分类存在性校验：不存在的 id 会撞 D1 外键被兜底成 500，提前拦截返回 400 Response；
// 通过返回 null。缺省/null id 由调用方先行跳过（0 等非法类型已被字段校验拦下）
async function ensureCategory(env, categoryId) {
  const cat = await env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId).first();
  return cat ? null : errorResponse('分类不存在', 'CATEGORY_NOT_FOUND', 400);
}

// 唯一索引冲突（单条新增/编辑撞重复 url）转 400，避免兜底成 500
function isDuplicateUrlError(error) {
  return /UNIQUE constraint failed: bookmarks\.url/i.test(String(error?.message || ''));
}

// 写路径统一 catch：重复 url 400，其余 500
function writeErrorResponse(error, logLabel) {
  if (isDuplicateUrlError(error)) {
    return errorResponse('书签链接已存在', 'VALIDATION_ERROR', 400);
  }
  console.error(logLabel, error);
  return errorResponse('服务器错误', 'INTERNAL_ERROR', 500);
}

// GET /api/bookmarks - 获取所有书签
// POST /api/bookmarks - 创建书签
export async function collection(request, env) {
  try {
    // GET - 获取所有书签
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        ORDER BY b.sort_order, b.id
      `).all();

      return Response.json(results);
    }

    // POST - 创建书签
    if (request.method === 'POST') {
      const data = await request.json();
      const err = validateBookmarkPayload(data);
      if (err) {
        return errorResponse(err, 'VALIDATION_ERROR', 400);
      }
      const { title, url, description, category_id, icon_url } = data;

      if (category_id) {
        const catErr = await ensureCategory(env, category_id);
        if (catErr) return catErr;
      }

      // sort_order 取 MAX+1：新书签固定排最后，忽略传入值
      const result = await env.DB.prepare(
        'INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM bookmarks))'
      ).bind(
        title.trim(),
        url,
        description || '',
        category_id || null,
        icon_url || ''
      ).run();

      return Response.json(
        { id: result.meta.last_row_id, success: true },
        { status: 201 }
      );
    }

    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  } catch (error) {
    return writeErrorResponse(error, 'Bookmarks API error:');
  }
}

// GET /api/bookmarks/:id - 获取单个书签
// PUT /api/bookmarks/:id - 更新书签
// DELETE /api/bookmarks/:id - 删除书签
export async function item(request, env, params) {
  const { id } = params;

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
        return errorResponse('书签不存在', 'NOT_FOUND', 404);
      }

      return Response.json(result);
    }

    // PUT - 更新书签
    if (request.method === 'PUT') {
      const data = await request.json();
      const err = validateBookmarkPayload(data);
      if (err) {
        return errorResponse(err, 'VALIDATION_ERROR', 400);
      }
      const { title, url, description, category_id, icon_url } = data;

      // 检查书签是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM bookmarks WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return errorResponse('书签不存在', 'NOT_FOUND', 404);
      }

      if (category_id) {
        const catErr = await ensureCategory(env, category_id);
        if (catErr) return catErr;
      }

      // is_pinned 缺省表示不修改（编辑书签保留固定状态），显式传值才写入并归一为 0/1
      const pinProvided = data.is_pinned !== undefined && data.is_pinned !== null;
      const pinnedVal = data.is_pinned === true || data.is_pinned === 1 ? 1 : 0;

      // 固定上限：转固定（is_pinned → 1）时校验；COUNT 排除自身，已固定的书签重复传 1 不算新增
      if (pinProvided && pinnedVal === 1) {
        const { n } = (await env.DB.prepare(
          'SELECT COUNT(*) AS n FROM bookmarks WHERE is_pinned = 1 AND id != ?'
        ).bind(id).first()) ?? { n: 0 };
        if (n >= MAX_PINNED) {
          return errorResponse(`最多固定 ${MAX_PINNED} 个书签`, 'VALIDATION_ERROR', 400);
        }
      }

      // 不更新 sort_order：编辑保留原排序
      await env.DB.prepare(
        `UPDATE bookmarks SET title = ?, url = ?, description = ?, category_id = ?, icon_url = ?${pinProvided ? ', is_pinned = ?' : ''}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(
        ...[
          title.trim(),
          url,
          description || '',
          category_id || null,
          icon_url || '',
          ...(pinProvided ? [pinnedVal] : []),
          id
        ]
      ).run();

      return Response.json({ success: true });
    }

    // DELETE - 删除书签
    if (request.method === 'DELETE') {
      // 检查书签是否存在
      const existing = await env.DB.prepare(
        'SELECT id FROM bookmarks WHERE id = ?'
      ).bind(id).first();

      if (!existing) {
        return errorResponse('书签不存在', 'NOT_FOUND', 404);
      }

      await env.DB.prepare(
        'DELETE FROM bookmarks WHERE id = ?'
      ).bind(id).run();

      return Response.json({ success: true });
    }

    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  } catch (error) {
    return writeErrorResponse(error, 'Bookmark API error:');
  }
}

// 按 url 字面值去重（保留首条）；比对库内已有书签，提前过滤省写入
// 并发竞态（查库后被抢先写入）由唯一索引 + INSERT OR IGNORE 兜底，见 batch
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
  // 各分块互不依赖，并行发出后合并命中集
  const slices = [];
  for (let i = 0; i < urls.length; i += QUERY_CHUNK_SIZE) {
    slices.push(urls.slice(i, i + QUERY_CHUNK_SIZE));
  }
  const queried = await Promise.all(slices.map(slice => {
    const placeholders = slice.map(() => '?').join(',');
    return env.DB.prepare(
      `SELECT url FROM bookmarks WHERE url IN (${placeholders})`
    ).bind(...slice).all();
  }));
  for (const { results } of queried) {
    for (const row of results) existing.add(row.url);
  }

  return batchUnique.filter(i => !existing.has(i.url));
}

// POST /api/bookmarks/batch - 批量创建书签（用于导入）
// 批内与库内双重去重 + 唯一索引兜底，避免重复导入产生冗余书签
export async function batch(request, env) {
  if (request.method !== 'POST') {
    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  }

  // JSON 解析失败单独捕获：请求体畸形属于客户端错误（400），与下方 catch 的服务端 500 兜底区分开
  let data;
  try {
    data = await request.json();
  } catch {
    return errorResponse('请求体格式不正确', 'VALIDATION_ERROR', 400);
  }

  try {
    const items = Array.isArray(data?.bookmarks) ? data.bookmarks : [];

    if (items.length === 0) {
      return errorResponse('bookmarks 不能为空', 'VALIDATION_ERROR', 400);
    }
    if (items.length > MAX_BATCH_SIZE) {
      return errorResponse(`单次最多导入 ${MAX_BATCH_SIZE} 条`, 'VALIDATION_ERROR', 400);
    }

    for (const item of items) {
      const err = validateBookmarkPayload(item);
      if (err) {
        return errorResponse(`${err}: ${item?.url || ''}`, 'VALIDATION_ERROR', 400);
      }
    }

    // 分类存在性校验（对齐单条 POST/PUT）：不存在的 id 会撞 D1 外键被兜底成 500，提前拦截返回 400
    // 去重后的 id 合成一条 IN 查询；缺省/null 视为未分类合法（0 等非法类型已被字段校验拦下）
    const catIds = [...new Set(items.map(i => i.category_id).filter(id => id !== undefined && id !== null))];
    if (catIds.length > 0) {
      const placeholders = catIds.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT id FROM categories WHERE id IN (${placeholders})`
      ).bind(...catIds).all();
      const found = new Set(results.map(r => r.id));
      if (catIds.some(id => !found.has(id))) {
        return errorResponse('分类不存在', 'CATEGORY_NOT_FOUND', 400);
      }
    }

    // 批内 + 库内双重去重，避免重复导入产生冗余书签
    const toInsert = await dedupe(env, items);

    // 新导入书签排最后：从库内 MAX(sort_order)+1 起按导入顺序递增
    let nextSort = 1;
    if (toInsert.length > 0) {
      const { max } = (await env.DB.prepare(
        'SELECT COALESCE(MAX(sort_order), 0) AS max FROM bookmarks'
      ).first()) ?? { max: 0 };
      nextSort = max + 1;
    }

    // D1 单次 batch 有语句数限制，分块提交
    // 插入用 INSERT OR IGNORE：唯一索引兜底查库后被并发抢先写入的竞态
    // count 按实际受影响行数统计（被忽略的行 changes 为 0），skipped 相应为总数减 count
    let count = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      const stmts = chunk.map((item, j) =>
        env.DB.prepare(
          'INSERT OR IGNORE INTO bookmarks (title, url, description, category_id, icon_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          item.title.trim(),
          item.url,
          item.description || '',
          item.category_id || null,
          item.icon_url || '',
          nextSort + i + j
        )
      );
      const results = await env.DB.batch(stmts);
      for (const r of results) count += r?.meta?.changes ?? 0;
    }

    return Response.json({ success: true, count, skipped: items.length - count });
  } catch (error) {
    console.error('Batch import error:', error);
    return errorResponse('服务器错误', 'INTERNAL_ERROR', 500);
  }
}
