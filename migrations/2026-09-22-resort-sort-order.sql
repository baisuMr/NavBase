-- 一次性迁移（2026-09-22）：按创建顺序（id 升序）重编 sort_order
-- 背景：旧逻辑新建时 sort_order=0，会排到预设分类（sort_order 1-5）之前，且编辑会把 sort_order 重置为 0
-- 执行本迁移理顺存量顺序后，新逻辑（新建/导入 MAX+1、编辑不改排序）保证新项固定排最后
-- 用法（本地与线上各执行一次）：
--   wrangler d1 execute navbase-db --file=migrations/2026-09-22-resort-sort-order.sql
--   wrangler d1 execute navbase-db --remote --file=migrations/2026-09-22-resort-sort-order.sql

UPDATE categories SET sort_order = (
  SELECT COUNT(*) FROM categories c2 WHERE c2.id <= categories.id
);

UPDATE bookmarks SET sort_order = (
  SELECT COUNT(*) FROM bookmarks b2 WHERE b2.id <= bookmarks.id
);
