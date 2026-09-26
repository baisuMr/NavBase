// worker/utils/token.js
// 期望 Basic 凭据 token 的统一构造：login 签发与 favicon k 校验共用，避免两处漂移
// token = Base64("用户名:密码")，与前端存储的凭据字符串一致
import { utf8ToBase64 } from './base64.js';

export function expectedToken(env) {
  const username = env.ADMIN_USERNAME || 'admin';
  return utf8ToBase64(`${username}:${env.ADMIN_PASSWORD}`);
}
