import { ref } from 'vue'
import { getFaviconKey, getFaviconCacheVer } from '../utils/faviconKey'
import { isAllowedDomain } from '../utils/domain'

// 失败回退的持续时长：与后端负面缓存 MISS_TTL（10 分钟）对齐，
// 到期后自动恢复重试（如后端图标已可获取）
const FAILED_TTL = 10 * 60 * 1000

// 域名解析结果缓存（url → hostname）：iconSrc 在模板中每渲染调用两次以上，
// 每次 new URL 解析属热路径重复计算；url 不可变，模块级缓存安全
const domainCache = new Map()

// 域名归一化（去 www. 前缀）；解析失败返回 ''，由调用方决定兜底
export function domainOf(url) {
  if (domainCache.has(url)) return domainCache.get(url)
  let domain = ''
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // 非法 url 保持 ''
  }
  domainCache.set(url, domain)
  return domain
}

// 域名合法性判定统一走 utils/domain.js（与 worker 同口径，测试向量锁定）：
// localhost / 内网 IP / 单段主机名等不合法域名不拼代理地址，直接回退首字头像

// 拼 /api/favicon 代理地址（带持证参数 k 与缓存世代 v）；域名不合法或 k 缺失返回 ''
// v 随站点设置换代即 URL 变化：浏览器缓存与服务端缓存键同时作废（清除图标缓存按钮）
export function faviconSrc(url) {
  const domain = domainOf(url)
  const k = getFaviconKey()
  if (!isAllowedDomain(domain) || !k) return ''
  return `/api/favicon/${domain}?k=${encodeURIComponent(k)}&v=${getFaviconCacheVer()}`
}

// 站点图标统一解析（BookmarkCard / 首屏搜索 / 常用站点 / 表单预览共用）：
// 1. 一律走 /api/favicon/:domain 图片代理并携带持证参数 k（img 无法带认证头，只能走持证 URL）
// 2. k 未就绪或加载失败 → src 置空，调用方渲染「首字头像」兜底（v-else 分支）
// 3. icon_url 已弃用（兼容位）：不读取直链，站点图标统一由代理探测
export function useFavicon() {
  // 加载失败的图标 key（按 url）→ 失败时间戳，整体替换以触发重渲染；
  // 失败与图标 URL 绑定：编辑书签换 URL 即重置失败态（对齐 BookmarkForm 预览口径）
  const failedAt = ref(new Map())

  function clearFailed(key) {
    const next = new Map(failedAt.value)
    next.delete(key)
    failedAt.value = next
  }

  function iconSrc(bookmark) {
    const failedTime = failedAt.value.get(bookmark.url)
    if (failedTime) {
      if (Date.now() - failedTime < FAILED_TTL) return ''
      // TTL 过期：移除失败记录，本次渲染即恢复重试
      clearFailed(bookmark.url)
    }
    return faviconSrc(bookmark.url)
  }

  function onIconError(bookmark) {
    const next = new Map(failedAt.value)
    next.set(bookmark.url, Date.now())
    failedAt.value = next
    // TTL 到期定时清除失败记录（替换 Map 触发重渲染）：闲置页面无需等下次渲染也能恢复重试。
    // 组件卸载后触发仅是更新已脱离模板的 ref，无副作用
    setTimeout(() => clearFailed(bookmark.url), FAILED_TTL)
  }

  // 兜底「首字头像」文本：取标题首字符（中文取汉字，兼容 emoji），无标题退域名首字符
  function iconInitial(bookmark) {
    const text = (bookmark.title || domainOf(bookmark.url) || '?').trim()
    return ([...text][0] || '?').toUpperCase()
  }

  return { iconSrc, onIconError, iconInitial }
}
