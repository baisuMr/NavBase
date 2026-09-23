// GET /api/settings 读取站点设置、PUT /api/settings 部分更新
// KV 存储于 D1 settings 表；认证由 auth.js 认证门统一保护
import { validateSettingsPayload } from '../utils/validate.js';

// 允许写入的键白名单，防止任意 KV 写入
const ALLOWED_KEYS = ['site_name', 'avatar'];

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function readSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const map = Object.fromEntries(results.map(row => [row.key, row.value]));
  return {
    site_name: map.site_name || '',
    avatar: map.avatar || ''
  };
}

export async function handle(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: HEADERS });
  }

  try {
    if (request.method === 'GET') {
      return Response.json(await readSettings(env), { headers: HEADERS });
    }

    if (request.method === 'PUT') {
      const data = await request.json();
      const err = validateSettingsPayload(data);
      if (err) {
        return Response.json({ error: err }, { status: 400, headers: HEADERS });
      }

      for (const key of ALLOWED_KEYS) {
        if (data[key] === undefined) continue;
        await env.DB.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
        ).bind(key, data[key]).run();
      }

      return Response.json(await readSettings(env), { headers: HEADERS });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: HEADERS });
  } catch (error) {
    console.error('Settings error:', error);
    return Response.json({ error: '服务器错误' }, { status: 500, headers: HEADERS });
  }
}
