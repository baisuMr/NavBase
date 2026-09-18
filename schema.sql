-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#3B82F6',
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
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '常用', '⭐', '#18181B', 1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '常用');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '开发', '💻', '#3F3F46', 2 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '开发');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '工具', '🔧', '#71717A', 3 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '工具');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '学习', '📚', '#3B82F6', 4 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '学习');
INSERT INTO categories (name, icon, color, sort_order)
  SELECT '娱乐', '🎮', '#6366F1', 5 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '娱乐');
