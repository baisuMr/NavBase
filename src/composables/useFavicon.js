import { ref } from 'vue'
import { getFaviconKey } from '../utils/faviconKey'

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

// 拼 /api/favicon 代理地址（带持证参数 k）；域名或 k 缺失返回 ''
export function faviconSrc(url) {
  const domain = domainOf(url)
  const k = getFaviconKey()
  if (!domain || !k) return ''
  return `/api/favicon/${domain}?k=${encodeURIComponent(k)}`
}

// 站点图标统一解析（BookmarkCard / 首屏搜索 / 常用站点 / 表单预览共用）：
// 1. 一律走 /api/favicon/:domain 图片代理并携带持证参数 k（img 无法带认证头，改持证 URL）
// 2. k 未就绪或加载失败 → src 置空，调用方渲染「首字头像」兜底（v-else 分支）
// 3. 历史 icon_url 直链已弃用式收编：不再读取，统一由代理探测
export function useFavicon() {
  // 加载失败的图标 key → 失败时间戳（id 优先，无 id 用 url 兜底），整体替换以触发重渲染
  const failedAt = ref(new Map())

  function keyOf(bookmark) {
    return bookmark.id ?? bookmark.url
  }

  function iconSrc(bookmark) {
    const key = keyOf(bookmark)
    const failedTime = failedAt.value.get(key)
    if (failedTime) {
      if (Date.now() - failedTime < FAILED_TTL) return ''
      // TTL 过期：移除失败记录，本次渲染即恢复重试
      const next = new Map(failedAt.value)
      next.delete(key)
      failedAt.value = next
    }
    return faviconSrc(bookmark.url)
  }

  function onIconError(bookmark) {
    const next = new Map(failedAt.value)
    next.set(keyOf(bookmark), Date.now())
    failedAt.value = next
  }

  // 兜底「首字头像」文本：取标题首字符（中文取汉字，兼容 emoji），无标题退域名首字符
  function iconInitial(bookmark) {
    const text = (bookmark.title || domainOf(bookmark.url) || '?').trim()
    return ([...text][0] || '?').toUpperCase()
  }

  return { iconSrc, onIconError, iconInitial }
}
