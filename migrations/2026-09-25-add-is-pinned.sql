-- 一次性迁移（2026-09-25）：bookmarks 表加 is_pinned 列（首屏常用站点固定标记，0/1）
-- 背景：首屏常用站点由「sort_order 前 5」改为「手动固定的书签」，固定上限 10
-- 用法（本地与线上各执行一次）：
--   wrangler d1 execute navbase-db --file=migrations/2026-09-25-add-is-pinned.sql
--   wrangler d1 execute navbase-db --remote --file=migrations/2026-09-25-add-is-pinned.sql
-- 预览库（navbase-db-preview）若已有旧表结构也需执行一次（--remote）

ALTER TABLE bookmarks ADD COLUMN is_pinned INTEGER DEFAULT 0;
