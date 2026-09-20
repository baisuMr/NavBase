// Basic Auth 认证中间件
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// 简易防爆破：所有认证失败路径统一延迟后再返回，拉高直接对 API 爆破凭据的成本
// （更完整的限速可配合 Cloudflare WAF 速率限制规则）
function bruteDelay() {
  return new Promise(resolve => setTimeout(resolve, 800));
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // CORS preflight 请求直接放行
  if (request.method === 'OPTIONS') {
    return context.next();
  }

  // Pages 中间件对静态资源同样生效；前端页面与 SPA 路由不携带敏感数据，
  // 直接放行（否则未登录时连登录页都无法加载），仅保护 /api/*
  // 注意：函数路由对路径大小写不敏感（实测 /API/ 变体可绕过小写前缀判断），
  // 因此先归一化再判断——解码百分号编码、合并连续斜杠、小写化，fail-closed
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // 畸形编码路径按原值参与判断
  }
  const normalized = path.replace(/\/{2,}/g, '/').toLowerCase();
  if (!normalized.startsWith('/api/')) {
    return context.next();
  }

  // 登录接口不需要认证（精确匹配，避免其它路径因包含该子串而绕过认证）
  if (url.pathname === '/api/auth/login') {
    return context.next();
  }

  // favicon 图片代理免认证：<img> 标签无法携带 Basic Auth 头，
  // 且该端点仅返回公开网站图标（域名由调用方提供），不含任何用户数据
  if (request.method === 'GET' && normalized.startsWith('/api/favicon/')) {
    return context.next();
  }

  // 未配置密码时直接拒绝，避免出现无密码的公开实例
  const adminUsername = env.ADMIN_USERNAME || 'admin';
  if (!env.ADMIN_PASSWORD) {
    return jsonResponse({ error: '服务器未配置 ADMIN_PASSWORD', code: 'NOT_CONFIGURED' }, 500);
  }

  // 验证 Basic Auth
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    await bruteDelay();
    return jsonResponse({ error: '未授权访问', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const decoded = atob(authHeader.replace('Basic ', ''));
    // Basic Auth 规范：用户名不含冒号，密码可以含冒号，因此只按第一个冒号分割
    const sep = decoded.indexOf(':');
    const username = sep === -1 ? decoded : decoded.slice(0, sep);
    const password = sep === -1 ? '' : decoded.slice(sep + 1);

    if (username !== adminUsername || password !== env.ADMIN_PASSWORD) {
      await bruteDelay();
      return jsonResponse({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' }, 401);
    }

    // 认证通过，继续处理请求
    return context.next();
  } catch (error) {
    console.error('Auth error:', error);
    await bruteDelay();
    return jsonResponse({ error: '认证失败', code: 'AUTH_ERROR' }, 401);
  }
}
