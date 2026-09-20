import { ref } from 'vue'

// 站点图标统一解析（BookmarkCard / HeroSearch 共用）：
// 1. bookmark.icon_url 非空 → 直接使用（历史数据为上游直链）
// 2. 为空 → 走 /api/favicon/:domain 图片代理（中间件免认证放行，<img> 可直接引用）
// 3. 加载失败 → src 置空，调用方渲染「首字头像」兜底（v-else 分支）
export function useFavicon() {
  // 加载失败的图标 key 集合（id 优先，无 id 用 url 兜底），整体替换以触发重渲染
  const failedIcons = ref(new Set())

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
    if (failedIcons.value.has(keyOf(bookmark))) return ''
    if (bookmark.icon_url) return bookmark.icon_url
    const domain = domainOf(bookmark)
    return domain ? `/api/favicon/${domain}` : ''
  }

  function onIconError(bookmark) {
    const next = new Set(failedIcons.value)
    next.add(keyOf(bookmark))
    failedIcons.value = next
  }

  // 兜底「首字头像」文本：取标题首字符（中文取汉字，兼容 emoji），无标题退域名首字符
  function iconInitial(bookmark) {
    const text = (bookmark.title || domainOf(bookmark) || '?').trim()
    return ([...text][0] || '?').toUpperCase()
  }

  return { iconSrc, onIconError, iconInitial }
}
