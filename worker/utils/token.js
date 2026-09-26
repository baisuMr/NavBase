// worker/utils/token.js
// 期望 Basic 凭据 token 的统一构造：login 签发与 favicon k 校验共用，避免两处漂移
// token = Base64("用户名:密码")，与前端存储的凭据字符串一致
import { utf8ToBase64 } from './base64.js';

// 管理员用户名取值（认证门 / 登录校验 / token 签发共用同一缺省）
export function adminUsername(env) {
  return env.ADMIN_USERNAME || 'admin';
}

export function expectedToken(env) {
  return utf8ToBase64(`${adminUsername(env)}:${env.ADMIN_PASSWORD}`);
}
