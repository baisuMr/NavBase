import { ref } from 'vue'

/**
 * 多搜索引擎定义与跳转
 * 默认 Google，可切换 GitHub / 开发者文档 / 百度 / 哔哩哔哩
 */
export const SEARCH_ENGINES = [
  { id: 'google',  label: 'Google',     url: 'https://www.google.com/search?q=',                accent: 'primary'   },
  { id: 'github',  label: 'GitHub',     url: 'https://github.com/search?q=',                   accent: 'neutral'   },
  { id: 'devdocs', label: '开发者文档',  url: 'https://devdocs.io/#q=',                        accent: 'neutral'   },
  { id: 'baidu',   label: '百度',       url: 'https://www.baidu.com/s?wd=',                    accent: 'neutral'   },
  { id: 'bilibili',label: '哔哩哔哩',    url: 'https://search.bilibili.com/all?keyword=',       accent: 'neutral'   }
]

export function useSearchEngines() {
  const currentEngineId = ref(SEARCH_ENGINES[0].id)

  const currentEngine = ref(SEARCH_ENGINES[0])

  function setEngine(id) {
    const engine = SEARCH_ENGINES.find(e => e.id === id)
    if (engine) {
      currentEngineId.value = id
      currentEngine.value = engine
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

    // 完整 URL
    if (/^https?:\/\//i.test(val)) {
      return { type: 'url', target: val }
    }

    // 纯域名或简单 URL（无空格，包含 .）
    if (/^[\w-]+\.[\w.\-/]+/.test(val) && !val.includes(' ')) {
      return { type: 'url', target: 'https://' + val }
    }

    // 搜索引擎搜索
    return { type: 'search', target: currentEngine.value.url + encodeURIComponent(val) }
  }

  /**
   * 触发外部跳转（浏览器新窗口）
   */
  function execute(query) {
    const result = resolveAndOpen(query)
    if (result) {
      window.open(result.target, '_blank', 'noopener,noreferrer')
    }
    return result
  }

  return {
    engines: SEARCH_ENGINES,
    currentEngineId,
    currentEngine,
    setEngine,
    resolveAndOpen,
    execute
  }
}
