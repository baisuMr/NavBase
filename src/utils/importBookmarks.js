import { isAllowedUrl } from './url'

// 与 worker/utils/validate.js 的入库上限对齐：解析期截断/过滤，
// 避免单条超长触发服务端「全有全无」校验、整批导入被 400 拒绝
const MAX_TITLE_LENGTH = 200
const MAX_URL_LENGTH = 2048
const MAX_NAME_LENGTH = 50

/**
 * 解析浏览器导出的 Netscape 格式书签 HTML
 * 返回 { categories: [{ name, links: [{title, url}] }], roots: [{title, url}] }
 * - 各层文件夹名作为分类名，同名文件夹自动合并
 * - 非法协议（javascript: 等）与非 http(s) 链接直接跳过（协议口径与表单共用 isAllowedUrl）
 * - 标题/文件夹名超上限截断，URL 超上限跳过（截断会破坏链接目标）
 * - 不解析 <ICON> 属性（icon_url 已弃用），图标统一走 /api/favicon 代理
 */
export function parseNetscapeBookmarks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const result = { categories: [], roots: [] }
  const catMap = new Map()

  function addLink(catName, anchor) {
    const url = (anchor.getAttribute('href') || '').trim()
    if (!isAllowedUrl(url)) return
    if (url.length > MAX_URL_LENGTH) return
    const title = ((anchor.textContent || '').trim() || url).slice(0, MAX_TITLE_LENGTH)
    const link = { title, url }
    if (!catName) {
      result.roots.push(link)
      return
    }
    if (!catMap.has(catName)) {
      const cat = { name: catName, links: [] }
      catMap.set(catName, cat)
      result.categories.push(cat)
    }
    catMap.get(catName).links.push(link)
  }

  function walkDL(dl, catName) {
    for (const dt of dl.children) {
      if (dt.tagName !== 'DT') continue
      const h3 = dt.querySelector(':scope > h3')
      const anchor = dt.querySelector(':scope > a')

      if (h3) {
        const name = h3.textContent.trim().slice(0, MAX_NAME_LENGTH)
        // 浏览器导出格式中，子 DL 通常是 H3 所在 DT 的兄弟节点（HTML 解析器会自动闭合 DT），
        // 部分实现也会作为 DT 的子节点，两种都兼容
        const next = dt.nextElementSibling
        if (next && next.tagName === 'DL') {
          walkDL(next, name)
        } else {
          const inner = dt.querySelector(':scope > dl')
          if (inner) walkDL(inner, name)
        }
      } else if (anchor) {
        addLink(catName, anchor)
      }
    }
  }

  const top = doc.querySelector('dl')
  if (top) walkDL(top, null)
  return result
}
