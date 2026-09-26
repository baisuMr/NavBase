// POST /api/auth/login - 用户登录
import { secureCompare, bruteDelay } from '../auth.js';
import { expectedToken, adminUsername } from '../utils/token.js';
import { errorResponse, notConfiguredError } from '../utils/http.js';

// 解析登录时长环境变量：非法（NaN）或非正数时回退默认，
// 避免 expiresAt 变成 null/NaN 被前端误判为已过期、登录后立刻被踢回登录页
function resolveDurationDays(raw, fallback) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function handle(request, env) {
  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  }

  // JSON 解析失败单独捕获：请求体畸形属于客户端错误（400），
  // 与下方 catch 的服务端 500 兜底区分开
  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('请求体格式不正确', 'VALIDATION_ERROR', 400);
  }

  try {
    const { username, password, remember } = payload;

    if (!username || !password) {
      return errorResponse('用户名和密码不能为空', 'VALIDATION_ERROR', 400);
    }

    // 未配置密码时拒绝登录，避免出现无密码的公开实例
    if (!env.ADMIN_PASSWORD) {
      return notConfiguredError();
    }

    // 验证用户名和密码（常数时间比较，防时序侧信道）
    const userOk = await secureCompare(username, adminUsername(env));
    const passOk = await secureCompare(password, env.ADMIN_PASSWORD);
    if (userOk && passOk) {
      // 生成 Basic Auth token（UTF-8 安全，支持中文等非 Latin-1 字符）
      const token = expectedToken(env);

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
    await bruteDelay();

    return errorResponse('用户名或密码错误', 'INVALID_CREDENTIALS', 401);
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('服务器错误', 'INTERNAL_ERROR', 500);
  }
}
