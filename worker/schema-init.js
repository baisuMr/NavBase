// D1 schema 自动初始化：首个 API 请求检测关键表，缺失则幂等执行根目录 schema.sql
// （经 wrangler.toml [[rules]] Text loader 以文本 import，单一数据源，勿在 worker 内复制 SQL）
import schemaSql from '../schema.sql';

// 关键表全齐才视为已初始化：旧库缺任何一张都会触发幂等补齐（CREATE TABLE IF NOT EXISTS）
const REQUIRED_TABLE_COUNT = 3; // categories / bookmarks / settings

let readyPromise = null;

async function init(env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name IN ('categories', 'bookmarks', 'settings')"
  ).first();
  if (row && row.cnt === REQUIRED_TABLE_COUNT) return;
  // schema.sql 全部为 IF NOT EXISTS / 条件插入，并发 isolate 重复执行安全
  await env.DB.exec(schemaSql);
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
