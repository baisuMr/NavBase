// 域名合法性校验：只放行形如 example.com 的公共域名，
// localhost / 内网 IP / 单段主机名等不拼图标代理地址，直接回退首字头像
// 算法契约与 worker/utils/domain.js 完全一致，双方测试向量锁定（见 src/utils/domain.test.js）
const ALLOWED_DOMAIN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/

// 域名合法（格式匹配且长度 ≤253）；空值/非法值一律 false
export function isAllowedDomain(domain) {
  return Boolean(domain) && domain.length <= 253 && ALLOWED_DOMAIN.test(domain)
}
