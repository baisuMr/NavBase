-- 一次性迁移（2026-09-26）：bookmarks.url 换建唯一索引，把导入去重下推数据库
-- 背景：原 idx_bookmarks_url 为普通索引，导入靠「先查再插」，并发双提交可产生重复行
-- 存量库可能已有重复 url：先清重（每组保留最小 id 的行），再删旧索引换唯一索引
-- 用法（本地与线上各执行一次，先清重再建索引，幂等可重复执行）：
--   wrangler d1 execute navbase-db --file=migrations/2026-09-26-unique-bookmark-url.sql
--   wrangler d1 execute navbase-db --remote --file=migrations/2026-09-26-unique-bookmark-url.sql
-- 预览库（navbase-db-preview）若沿用旧结构也需执行一次（--remote）

DELETE FROM bookmarks WHERE id NOT IN (SELECT MIN(id) FROM bookmarks GROUP BY url);
DROP INDEX IF EXISTS idx_bookmarks_url;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
