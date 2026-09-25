// GET /api/settings 读取站点设置、PUT /api/settings 部分更新
// KV 存储于 D1 settings 表；认证由 auth.js 认证门统一保护
import { validateSettingsPayload } from '../utils/validate.js';

// 允许写入的键白名单，防止任意 KV 写入
const ALLOWED_KEYS = ['site_name', 'avatar'];

async function readSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const map = Object.fromEntries(results.map(row => [row.key, row.value]));
  return {
    site_name: map.site_name || '',
    avatar: map.avatar || ''
  };
}

export async function handle(request, env) {
  try {
    if (request.method === 'GET') {
      return Response.json(await readSettings(env));
    }

    if (request.method === 'PUT') {
      const data = await request.json();
      const err = validateSettingsPayload(data);
      if (err) {
        return Response.json({ error: err, code: 'VALIDATION_ERROR' }, { status: 400 });
      }

      for (const key of ALLOWED_KEYS) {
        if (data[key] === undefined) continue;
        await env.DB.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
        ).bind(key, data[key]).run();
      }

      return Response.json(await readSettings(env));
    }

    return Response.json({ error: '请求方法不支持', code: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  } catch (error) {
    console.error('Settings error:', error);
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
