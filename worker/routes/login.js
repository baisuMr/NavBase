// POST /api/auth/login - 用户登录
import { secureCompare } from '../auth.js';
import { utf8ToBase64 } from '../utils/base64.js';

// 解析登录时长环境变量：非法（NaN）或非正数时回退默认，
// 避免 expiresAt 变成 null/NaN 被前端误判为已过期、登录后立刻被踢回登录页
function resolveDurationDays(raw, fallback) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function handle(request, env) {
  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    const { username, password, remember } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 未配置密码时拒绝登录，避免出现无密码的公开实例
    if (!env.ADMIN_PASSWORD) {
      return Response.json(
        { error: '服务器未配置 ADMIN_PASSWORD' },
        { status: 500 }
      );
    }

    const adminUsername = env.ADMIN_USERNAME || 'admin';

    // 验证用户名和密码（常数时间比较，防时序侧信道）
    const userOk = await secureCompare(username, adminUsername);
    const passOk = await secureCompare(password, env.ADMIN_PASSWORD);
    if (userOk && passOk) {
      // 生成 Basic Auth token（UTF-8 安全，支持中文等非 Latin-1 字符）
      const token = utf8ToBase64(`${username}:${password}`);

      // 勾选记住设备 → REMEMBER_DURATION_DAYS（默认30天）；否则 LOGIN_DURATION_DAYS（默认7天）
      const rememberMe = remember === true;
      const durationDays = rememberMe
        ? resolveDurationDays(env.REMEMBER_DURATION_DAYS, 30)
        : resolveDurationDays(env.LOGIN_DURATION_DAYS, 7);
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
        }
      );
    }

    // 简易防爆破：失败时统一延迟后再返回（更完整的方案可配合 WAF 速率限制）
    await new Promise(resolve => setTimeout(resolve, 800));

    return Response.json(
      { error: '用户名或密码错误' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
