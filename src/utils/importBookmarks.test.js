// @vitest-environment jsdom
// 浏览器书签 HTML 解析器单测（用 jsdom：其 WHATWG 解析器对 DT/DL 的处理与真实浏览器一致，
// happy-dom 会把 <p> 错误嵌套为 DL>P>DT，导致解析结果为空）
import { describe, it, expect } from 'vitest'
import { parseNetscapeBookmarks } from './importBookmarks'

const CHROME_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>开发工具</H3>
    <DL><p>
        <DT><A HREF="https://github.com/">GitHub</A>
        <DT><A HREF="javascript:void(0)">恶意脚本</A>
        <DT><A HREF="ftp://files.example.com/pub">FTP 资源</A>
        <DT><H3>前端</H3>
        <DL><p>
            <DT><A HREF="https://developer.mozilla.org/">MDN</A>
        </DL><p>
    </DL><p>
    <DT><H3>开发工具</H3>
    <DL><p>
        <DT><A HREF="https://stackoverflow.com/">Stack Overflow</A>
    </DL><p>
    <DT><A HREF="https://www.wikipedia.org/">维基百科（根级）</A>
</DL><p>`

// 部分 Chrome 版本会将子 DL 解析为 H3 所在 DT 的子节点
const NESTED_DL_FORMAT = `<DL><p>
  <DT><H3>工具</H3>
  <DL><p>
    <DT><A HREF="https://a.com/">A 站</A>
  </DL><p>
</DL><p>`

describe('parseNetscapeBookmarks', () => {
  it('解析书签并按文件夹分类', () => {
    const r = parseNetscapeBookmarks(CHROME_EXPORT)
    const names = r.categories.map(c => c.name)
    expect(names).toContain('开发工具')
    expect(names).toContain('前端')
  })

  it('同名文件夹自动合并，链接合并到同一分类', () => {
    const r = parseNetscapeBookmarks(CHROME_EXPORT)
    const dev = r.categories.filter(c => c.name === '开发工具')
    expect(dev).toHaveLength(1)
    expect(dev[0].links.map(l => l.title).sort()).toEqual(['GitHub', 'Stack Overflow'])
  })

  it('嵌套文件夹成为独立分类', () => {
    const r = parseNetscapeBookmarks(CHROME_EXPORT)
    const fe = r.categories.find(c => c.name === '前端')
    expect(fe.links[0].title).toBe('MDN')
  })

  it('javascript/ftp 等非法协议被跳过', () => {
    const r = parseNetscapeBookmarks(CHROME_EXPORT)
    const all = r.categories.flatMap(c => c.links).map(l => l.title)
    expect(all).not.toContain('恶意脚本')
    expect(all).not.toContain('FTP 资源')
  })

  it('根级直链归入 roots', () => {
    const r = parseNetscapeBookmarks(CHROME_EXPORT)
    expect(r.roots).toHaveLength(1)
    expect(r.roots[0].title).toBe('维基百科（根级）')
    expect(r.roots[0].url).toBe('https://www.wikipedia.org/')
  })

  it('兼容子 DL 为 DT 子节点的格式', () => {
    const r = parseNetscapeBookmarks(NESTED_DL_FORMAT)
    expect(r.categories).toHaveLength(1)
    expect(r.categories[0].name).toBe('工具')
    expect(r.categories[0].links[0].url).toBe('https://a.com/')
  })

  it('空 HTML 返回空结构', () => {
    const r = parseNetscapeBookmarks('<html><body></body></html>')
    expect(r.categories).toHaveLength(0)
    expect(r.roots).toHaveLength(0)
  })

  it('无标题链接回退用 URL 作为标题', () => {
    const html = '<DL><p><DT><A HREF="https://notitle.com/"></A></DL><p>'
    const r = parseNetscapeBookmarks(html)
    expect(r.roots[0].title).toBe('https://notitle.com/')
  })

  it('忽略 ICON 属性（icon_url 直链弃用式收编）', () => {
    const html = `<DL><p>
      <DT><A HREF="https://a.com/" ICON="data:image/png;base64,AAAA">A 站</A>
      <DT><A HREF="https://b.com/" ICON="https://cdn.b.com/i.png">B 站</A>
    </DL><p>`
    const r = parseNetscapeBookmarks(html)
    for (const link of [...r.roots]) {
      expect(link).not.toHaveProperty('icon_url')
    }
  })
})
