import { ref } from 'vue'

// 失败回退的持续时长：与后端负面缓存 MISS_TTL（10 分钟）对齐，
// 到期后自动恢复重试（如 icon_url 已被编辑或后端图标已可获取）
const FAILED_TTL = 10 * 60 * 1000

// 站点图标统一解析（BookmarkCard / HeroSearch 共用）：
// 1. bookmark.icon_url 非空 → 直接使用（历史数据为上游直链）
// 2. 为空 → 走 /api/favicon/:domain 图片代理（中间件免认证放行，<img> 可直接引用）
// 3. 加载失败 → src 置空，调用方渲染「首字头像」兜底（v-else 分支）
export function useFavicon() {
  // 加载失败的图标 key → 失败时间戳（id 优先，无 id 用 url 兜底），整体替换以触发重渲染
  const failedAt = ref(new Map())

  function keyOf(bookmark) {
    return bookmark.id ?? bookmark.url
  }

  function domainOf(bookmark) {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
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
    if (bookmark.icon_url) return bookmark.icon_url
    const domain = domainOf(bookmark)
    return domain ? `/api/favicon/${domain}` : ''
  }

  function onIconError(bookmark) {
    const next = new Map(failedAt.value)
    next.set(keyOf(bookmark), Date.now())
    failedAt.value = next
  }

  // 兜底「首字头像」文本：取标题首字符（中文取汉字，兼容 emoji），无标题退域名首字符
  function iconInitial(bookmark) {
    const text = (bookmark.title || domainOf(bookmark) || '?').trim()
    return ([...text][0] || '?').toUpperCase()
  }

  return { iconSrc, onIconError, iconInitial }
}
