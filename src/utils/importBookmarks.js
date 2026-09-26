import { isAllowedUrl } from './url'

/**
 * 解析浏览器导出的 Netscape 格式书签 HTML
 * 返回 { categories: [{ name, links: [{title, url}] }], roots: [{title, url}] }
 * - 各层文件夹名作为分类名，同名文件夹自动合并
 * - 非法协议（javascript: 等）与非 http(s) 链接直接跳过（协议口径与表单共用 isAllowedUrl）
 * // <ICON> 属性已弃用式收编：不再解析，图标统一走 /api/favicon 代理
 */
export function parseNetscapeBookmarks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const result = { categories: [], roots: [] }
  const catMap = new Map()

  function addLink(catName, anchor) {
    const url = anchor.getAttribute('href') || ''
    const title = (anchor.textContent || '').trim() || url
    if (!isAllowedUrl(url)) return
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
        // 浏览器导出格式中，子 DL 通常是 H3 所在 DT 的兄弟节点（HTML 解析器会自动闭合 DT），
        // 部分实现也会作为 DT 的子节点，两种都兼容
        const next = dt.nextElementSibling
        if (next && next.tagName === 'DL') {
          walkDL(next, h3.textContent.trim())
        } else {
          const inner = dt.querySelector(':scope > dl')
          if (inner) walkDL(inner, h3.textContent.trim())
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
