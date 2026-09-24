-- 注意：本文件被 worker/schema-init.js 按行剥离注释并按分号拆分后逐条执行，
-- 请保持约束：注释独立成行（勿加在语句行尾）、字符串值不得含分号
-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'ri-folder-line',
  color TEXT DEFAULT '#10b981',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 书签表
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id INTEGER,
  icon_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_sort ON bookmarks(sort_order);
CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);

-- 插入默认分类（幂等：同名分类已存在时跳过，可重复执行）
-- 颜色取自前端预设 10 色（Home.vue presetColors），与 UI 配色体系一致
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '常用', 'ri-star-line', '#2563EB', 1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '常用');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '开发', 'ri-computer-line', '#4F46E5', 2 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '开发');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '工具', 'ri-tools-line', '#10b981', 3 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '工具');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '学习', 'ri-book-2-line', '#7C3AED', 4 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '学习');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '娱乐', 'ri-gamepad-line', '#DB2777', 5 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '娱乐');

-- 站点设置表（KV 结构：site_name / avatar）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
