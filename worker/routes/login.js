// POST /api/auth/login - 用户登录
import { secureCompare } from '../auth.js';

export async function handle(request, env) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers }
    );
  }

  try {
    const { username, password, remember } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: '用户名和密码不能为空' },
        { status: 400, headers }
      );
    }

    // 未配置密码时拒绝登录，避免出现无密码的公开实例
    if (!env.ADMIN_PASSWORD) {
      return Response.json(
        { error: '服务器未配置 ADMIN_PASSWORD' },
        { status: 500, headers }
      );
    }

    const adminUsername = env.ADMIN_USERNAME || 'admin';

    // 验证用户名和密码（常数时间比较，防时序侧信道）
    const userOk = await secureCompare(username, adminUsername);
    const passOk = await secureCompare(password, env.ADMIN_PASSWORD);
    if (userOk && passOk) {
      // 生成 Basic Auth token
      const token = btoa(`${username}:${password}`);

      // 勾选记住设备 → REMEMBER_DURATION_DAYS（默认30天）；否则 LOGIN_DURATION_DAYS（默认7天）
      const rememberMe = remember === true;
      const durationDays = rememberMe
        ? parseInt(env.REMEMBER_DURATION_DAYS || '30', 10)
        : parseInt(env.LOGIN_DURATION_DAYS || '7', 10);
      const expiresIn = durationDays * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + expiresIn;

      return Response.json(
        {
          token,
          expiresAt,
          durationDays,
          remember: rememberMe,
          username,
          success: true
        },
        { headers }
      );
    }

    // 简易防爆破：失败时统一延迟后再返回（更完整的方案可配合 WAF 速率限制）
    await new Promise(resolve => setTimeout(resolve, 800));

    return Response.json(
      { error: '用户名或密码错误' },
      { status: 401, headers }
    );
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500, headers }
    );
  }
}
