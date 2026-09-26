// NavBase Worker 入口：认证门 → 显式路由表 → ASSETS 兜底（SPA 回退由 assets 配置应用）
import { authGate } from './auth.js';
import { ensureSchema } from './schema-init.js';
import { handle as handleLogin } from './routes/login.js';
import {
  collection as bookmarksCollection,
  item as bookmarksItem,
  batch as bookmarksBatch
} from './routes/bookmarks.js';
import {
  collection as categoriesCollection,
  item as categoriesItem,
  sort as categoriesSort
} from './routes/categories.js';
import { handle as handleSettings } from './routes/settings.js';
import { handle as handleFavicon } from './routes/favicon.js';

// 路由表：顺序即优先级，字面量段先于 :param 段（batch/sort 不会与 :id 冲突）
// 匹配对路径大小写不敏感（与历史 Pages Functions 路由行为对齐）；params 值保留原始大小写
const routes = [
  { pattern: '/api/auth/login', handler: handleLogin },
  { pattern: '/api/bookmarks', handler: bookmarksCollection },
  { pattern: '/api/bookmarks/batch', handler: bookmarksBatch },
  { pattern: '/api/bookmarks/:id', handler: bookmarksItem },
  { pattern: '/api/categories', handler: categoriesCollection },
  { pattern: '/api/categories/sort', handler: categoriesSort },
  { pattern: '/api/categories/:id', handler: categoriesItem },
  { pattern: '/api/settings', handler: handleSettings },
  { pattern: '/api/favicon/:domain', handler: handleFavicon }
];

// 归一化：解码百分号编码、合并连续斜杠、去末尾斜杠（保留大小写，param 值不受影响）
function normalizePath(pathname) {
  let path = pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // 畸形编码路径按原值参与匹配
  }
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

function matchRoute(pathname) {
  const segments = normalizePath(pathname).split('/').filter(Boolean);
  for (const route of routes) {
    const patternSegments = route.pattern.split('/').filter(Boolean);
    if (patternSegments.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < segments.length; i++) {
      const pat = patternSegments[i];
      const seg = segments[i];
      if (pat.startsWith(':')) {
        params[pat.slice(1)] = seg;
      } else if (pat.toLowerCase() !== seg.toLowerCase()) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler: route.handler, params };
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    // 认证门：保护 /api/*（豁免登录与 favicon），非 API 路径直接放行
    const gate = await authGate(request, env);
    if (gate) return gate;

    const matched = matchRoute(new URL(request.url).pathname);
    if (matched) {
      // favicon 在认证门放行、由处理器自验 k 持证与 Sec-Fetch 来源，且不依赖 DB，跳过初始化；
      // 其余 API 路由（含登录）首次请求惰性建表，保证一键部署出的空库开箱即用
      if (matched.handler !== handleFavicon) {
        try {
          await ensureSchema(env);
        } catch (err) {
          console.error('schema init failed', err);
          return Response.json({ error: '数据库初始化失败', code: 'DB_INIT_FAILED' }, { status: 500 });
        }
      }
      return matched.handler(request, env, matched.params, ctx);
    }

    // API 路径未命中路由表：显式 404 JSON，避免落 SPA 回退返回 index.html
    // 前缀判断与认证门一致（归一化 + 小写化），大小写变体一并覆盖；其余路径保持 SPA 回退
    const normalized = normalizePath(new URL(request.url).pathname).toLowerCase();
    if (normalized.startsWith('/api/')) {
      return Response.json({ error: '接口不存在', code: 'NOT_FOUND' }, { status: 404 });
    }

    // 未命中路由：交回静态资源服务（not_found_handling 的 SPA 回退在此生效）
    return env.ASSETS.fetch(request);
  }
};
