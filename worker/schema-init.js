// D1 schema 自动初始化：首个 API 请求检测关键表，缺失则幂等执行根目录 schema.sql
// （经 wrangler.toml [[rules]] Text loader 以文本 import，单一数据源，勿在 worker 内复制 SQL）
import schemaSql from '../schema.sql';

// 关键表全齐才视为已初始化：旧库缺任何一张都会触发幂等补齐（CREATE TABLE IF NOT EXISTS）
const REQUIRED_TABLE_COUNT = 3; // categories / bookmarks / settings
// 关键列探测：表齐不代表列齐（列级迁移漏跑时幂等补列），ALTER 定义与 schema.sql 保持一致
const REQUIRED_COLUMNS = { bookmarks: ['is_pinned'] };

let readyPromise = null;

async function init(env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name IN ('categories', 'bookmarks', 'settings')"
  ).first();
  const tablesReady = row && row.cnt === REQUIRED_TABLE_COUNT;
  if (!tablesReady) {
    // 本地 miniflare 的 D1 exec 对注释段与多行语句均报错（did not contain a statement /
    // incomplete input），不可依赖；改为剥离整行注释后按分号拆分、batch 顺序执行，
    // batch 为常规 API，本地与线上行为一致。schema.sql 注释均为独立行且字符串值不含
    // 分号，拆分安全；语句本身全部为 IF NOT EXISTS / 条件插入，并发 isolate 重复执行安全
    const statements = schemaSql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    try {
      await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
    } catch (err) {
      // 已知边缘（Task 13 索引 UNIQUE 化）：存量库含重复 url 且恰好缺表时，全量
      // schema.sql 中 CREATE UNIQUE INDEX idx_bookmarks_url 会因唯一约束失败。
      // 不静默半初始化：此处带上下文上抛（index.js 统一转 500 DB_INIT_FAILED），
      // 失败已清 readyPromise 可重试；修复前提是先跑
      // migrations/2026-09-26-unique-bookmark-url.sql 清重后再触发初始化
      const hint =
        /UNIQUE constraint failed|idx_bookmarks_url/i.test(String(err?.message ?? err))
          ? '（疑似存量重复 url 导致 idx_bookmarks_url 唯一索引创建失败，需先执行 migrations/2026-09-26-unique-bookmark-url.sql 清重）'
          : '';
      throw new Error(`schema.sql 执行失败：${err?.message ?? err}${hint}`);
    }
  }

  // 关键列探测（表齐也执行）：用 all 查 PRAGMA table_info，缺列才 run ALTER（幂等）
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    const have = new Set((results ?? []).map((r) => r.name));
    for (const col of columns) {
      if (have.has(col)) continue;
      // is_pinned 与 schema.sql 定义一致：INTEGER DEFAULT 0
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} INTEGER DEFAULT 0`).run();
    }
  }
}

export async function ensureSchema(env) {
  if (!readyPromise) {
    readyPromise = init(env).catch((err) => {
      readyPromise = null; // 失败后清缓存，下次请求重试
      throw err;
    });
  }
  return readyPromise;
}
