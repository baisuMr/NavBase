import { ref, computed } from 'vue'
import { isAllowedUrl } from '../utils/url'

/**
 * 多搜索引擎定义与跳转
 * 默认百度，可切换 Google / GitHub
 */
export const SEARCH_ENGINES = [
  { id: 'baidu',  label: '百度',   icon: 'ri-baidu-fill',  url: 'https://www.baidu.com/s?wd=',      home: 'https://www.baidu.com'  },
  { id: 'google', label: 'Google', icon: 'ri-google-fill', url: 'https://www.google.com/search?q=', home: 'https://www.google.com' },
  { id: 'github', label: 'GitHub', icon: 'ri-github-fill', url: 'https://github.com/search?q=',     home: 'https://github.com'     }
]

export function useSearchEngines() {
  // 单一真相源只存 id，currentEngine 由 id 派生，避免双份手工同步
  const currentEngineId = ref(SEARCH_ENGINES[0].id)
  const currentEngine = computed(
    () => SEARCH_ENGINES.find(e => e.id === currentEngineId.value) || SEARCH_ENGINES[0]
  )

  function setEngine(id) {
    if (SEARCH_ENGINES.some(e => e.id === id)) {
      currentEngineId.value = id
    }
  }

  /**
   * 解析用户输入：
   *  - 完整 URL (http:// 或 https://) → 直接打开
   *  - 纯域名（如 github.com 或 example.org/path）→ 直接打开
   *  - 其他 → 按当前引擎搜索
   */
  function resolveAndOpen(query) {
    const val = (query || '').trim()
    if (!val) return null

    // 完整 URL（协议口径与书签白名单共用 isAllowedUrl）
    if (isAllowedUrl(val)) {
      return { type: 'url', target: val }
    }

    // 纯域名或简单 URL（无空格，包含 .）
    if (/^[\w-]+\.[\w.\-/]+/.test(val) && !val.includes(' ')) {
      return { type: 'url', target: 'https://' + val }
    }

    // 搜索引擎搜索
    return { type: 'search', target: currentEngine.value.url + encodeURIComponent(val) }
  }

  return {
    engines: SEARCH_ENGINES,
    currentEngineId,
    currentEngine,
    setEngine,
    resolveAndOpen
  }
}
