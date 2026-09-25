-- 测试数据：向 5 个分类各插入 10 个书签（本地库专用，可重复执行）
-- 重复执行会先清除旧测试数据（按 description = '测试数据' 识别）再重新插入
-- 用法：
--   pnpm exec wrangler d1 execute navbase-db --file=scripts/seed-test-data.sql
-- 说明：
--   常用分类前 5 个书签 is_pinned = 1（用于首屏常用站点），其余未固定
--   category_id 按分类名查找（常用/开发/工具/学习/娱乐），分类缺失时该条落为未分类
--   sort_order 从 1001 起递增（排在真实书签之后）

DELETE FROM bookmarks WHERE description = '测试数据';

INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order, is_pinned)
WITH v(title, url, sort_order, is_pinned) AS (
  VALUES
    ('Google', 'https://www.google.com', 1001, 1),
    ('GitHub', 'https://github.com', 1002, 1),
    ('哔哩哔哩', 'https://www.bilibili.com', 1003, 1),
    ('知乎', 'https://www.zhihu.com', 1004, 1),
    ('Gmail', 'https://mail.google.com', 1005, 1),
    ('百度', 'https://www.baidu.com', 1006, 0),
    ('微博', 'https://weibo.com', 1007, 0),
    ('淘宝', 'https://www.taobao.com', 1008, 0),
    ('京东', 'https://www.jd.com', 1009, 0),
    ('豆瓣', 'https://www.douban.com', 1010, 0)
)
SELECT v.title, v.url, '测试数据', (SELECT id FROM categories WHERE name = '常用'), '', v.sort_order, v.is_pinned
FROM v;

INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order, is_pinned)
WITH v(title, url, sort_order, is_pinned) AS (
  VALUES
    ('MDN Web Docs', 'https://developer.mozilla.org', 1011, 0),
    ('Stack Overflow', 'https://stackoverflow.com', 1012, 0),
    ('GitHub Docs', 'https://docs.github.com', 1013, 0),
    ('Vue.js', 'https://vuejs.org', 1014, 0),
    ('Cloudflare Docs', 'https://developers.cloudflare.com', 1015, 0),
    ('npm', 'https://www.npmjs.com', 1016, 0),
    ('Can I Use', 'https://caniuse.com', 1017, 0),
    ('DevDocs', 'https://devdocs.io', 1018, 0),
    ('LeetCode', 'https://leetcode.cn', 1019, 0),
    ('掘金', 'https://juejin.cn', 1020, 0)
)
SELECT v.title, v.url, '测试数据', (SELECT id FROM categories WHERE name = '开发'), '', v.sort_order, v.is_pinned
FROM v;

INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order, is_pinned)
WITH v(title, url, sort_order, is_pinned) AS (
  VALUES
    ('Convertio', 'https://convertio.co', 1021, 0),
    ('TinyPNG', 'https://tinypng.com', 1022, 0),
    ('JSON Editor Online', 'https://jsoneditoronline.org', 1023, 0),
    ('Regex101', 'https://regex101.com', 1024, 0),
    ('Carbon', 'https://carbon.now.sh', 1025, 0),
    ('Excalidraw', 'https://excalidraw.com', 1026, 0),
    ('ProcessOn', 'https://www.processon.com', 1027, 0),
    ('草料二维码', 'https://cli.im', 1028, 0),
    ('iLovePDF', 'https://www.ilovepdf.com', 1029, 0),
    ('在线工具', 'https://tool.lu', 1030, 0)
)
SELECT v.title, v.url, '测试数据', (SELECT id FROM categories WHERE name = '工具'), '', v.sort_order, v.is_pinned
FROM v;

INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order, is_pinned)
WITH v(title, url, sort_order, is_pinned) AS (
  VALUES
    ('Coursera', 'https://www.coursera.org', 1031, 0),
    ('Khan Academy', 'https://www.khanacademy.org', 1032, 0),
    ('慕课网', 'https://www.imooc.com', 1033, 0),
    ('中国大学MOOC', 'https://www.icourse163.org', 1034, 0),
    ('freeCodeCamp', 'https://www.freecodecamp.org', 1035, 0),
    ('W3Schools', 'https://www.w3schools.com', 1036, 0),
    ('GeeksforGeeks', 'https://www.geeksforgeeks.org', 1037, 0),
    ('语雀', 'https://www.yuque.com', 1038, 0),
    ('Wikipedia', 'https://www.wikipedia.org', 1039, 0),
    ('MDN 学习区', 'https://developer.mozilla.org/zh-CN/docs/Learn', 1040, 0)
)
SELECT v.title, v.url, '测试数据', (SELECT id FROM categories WHERE name = '学习'), '', v.sort_order, v.is_pinned
FROM v;

INSERT INTO bookmarks (title, url, description, category_id, icon_url, sort_order, is_pinned)
WITH v(title, url, sort_order, is_pinned) AS (
  VALUES
    ('YouTube', 'https://www.youtube.com', 1041, 0),
    ('Netflix', 'https://www.netflix.com', 1042, 0),
    ('Spotify', 'https://open.spotify.com', 1043, 0),
    ('Steam', 'https://store.steampowered.com', 1044, 0),
    ('网易云音乐', 'https://music.163.com', 1045, 0),
    ('起点读书', 'https://www.qidian.com', 1046, 0),
    ('猫眼电影', 'https://www.maoyan.com', 1047, 0),
    ('Twitch', 'https://www.twitch.tv', 1048, 0),
    ('任天堂', 'https://www.nintendo.com', 1049, 0),
    ('4399 小游戏', 'https://www.4399.com', 1050, 0)
)
SELECT v.title, v.url, '测试数据', (SELECT id FROM categories WHERE name = '娱乐'), '', v.sort_order, v.is_pinned
FROM v;
