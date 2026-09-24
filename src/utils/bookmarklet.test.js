import { describe, it, expect } from 'vitest'
import { buildQuickAddBookmarklet } from './bookmarklet'

// 在 node 里执行生成的书签脚本体（去掉 javascript: 前缀），
// 用替身的 location/document/open 验证真实采集与拼参行为
function runBookmarklet(script, { href, title, selection = '', metaDesc = null }) {
  const opened = []
  const location = { href }
  const document = {
    title,
    getSelection: () => selection,
    querySelector: (sel) => (sel === '[name=description]' && metaDesc != null ? { getAttribute: () => metaDesc } : null)
  }
  const open = (url) => {
    opened.push(url)
    return null
  }
  const body = script.replace(/^javascript:/, '')
  new Function('location', 'document', 'open', 'encodeURIComponent', body)(location, document, open, encodeURIComponent)
  return opened
}

describe('buildQuickAddBookmarklet', () => {
  const ORIGIN = 'https://nav.example'

  it('生成 javascript: 单行书签脚本并嵌入站点 quick-add 地址', () => {
    const script = buildQuickAddBookmarklet(ORIGIN)
    expect(script.startsWith('javascript:')).toBe(true)
    expect(script.includes('\n')).toBe(false)
    expect(script.includes(`${ORIGIN}/quick-add`)).toBe(true)
  })

  it('有选中文本时作为 desc 传入', () => {
    const [opened] = runBookmarklet(buildQuickAddBookmarklet(ORIGIN), {
      href: 'https://target.example/page?a=1',
      title: '目标页',
      selection: '选中的段落'
    })
    expect(opened).toContain(`${ORIGIN}/quick-add?url=${encodeURIComponent('https://target.example/page?a=1')}`)
    expect(opened).toContain(`title=${encodeURIComponent('目标页')}`)
    expect(opened).toContain(`desc=${encodeURIComponent('选中的段落')}`)
  })

  it('无选中时回退 meta description', () => {
    const [opened] = runBookmarklet(buildQuickAddBookmarklet(ORIGIN), {
      href: 'https://target.example/x',
      title: 'X',
      selection: '',
      metaDesc: '页面描述'
    })
    expect(opened).toContain(`desc=${encodeURIComponent('页面描述')}`)
  })

  it('无选中也无 meta description 时 desc 为空', () => {
    const [opened] = runBookmarklet(buildQuickAddBookmarklet(ORIGIN), {
      href: 'https://target.example/x',
      title: 'X'
    })
    expect(opened).toContain('desc=')
  })

  it('desc 超过 500 字截断并追加省略号', () => {
    const long = 'd'.repeat(600)
    const [opened] = runBookmarklet(buildQuickAddBookmarklet(ORIGIN), {
      href: 'https://target.example/x',
      title: 'X',
      selection: long
    })
    const expected = 'd'.repeat(500) + '...'
    expect(opened).toContain(`desc=${encodeURIComponent(expected)}`)
  })
})
