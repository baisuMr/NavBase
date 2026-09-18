// Basic Auth 认证中间件
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
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
  if (!url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // 登录接口不需要认证（精确匹配，避免其它路径因包含该子串而绕过认证）
  if (url.pathname === '/api/auth/login') {
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
    return jsonResponse({ error: '未授权访问', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const decoded = atob(authHeader.replace('Basic ', ''));
    // Basic Auth 规范：用户名不含冒号，密码可以含冒号，因此只按第一个冒号分割
    const sep = decoded.indexOf(':');
    const username = sep === -1 ? decoded : decoded.slice(0, sep);
    const password = sep === -1 ? '' : decoded.slice(sep + 1);

    if (username !== adminUsername || password !== env.ADMIN_PASSWORD) {
      return jsonResponse({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' }, 401);
    }

    // 认证通过，继续处理请求
    return context.next();
  } catch (error) {
    console.error('Auth error:', error);
    return jsonResponse({ error: '认证失败', code: 'AUTH_ERROR' }, 401);
  }
}
