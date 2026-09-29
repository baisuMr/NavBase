import { filterBookmarks } from './filterBookmarks'

// 「全部」视图书签按分类分组：分类序在前（空分类跳过）、未分类垫后（有才出现）
// 未分类 = category_id 为空或不属于任何已知分类（悬空 id 正常不出现，兜底保证「全部」不丢书签）
export function groupBookmarksByCategory(bookmarks, categories) {
  const list = bookmarks || []
  const groups = []
  for (const cat of categories || []) {
    const items = list.filter((b) => b.category_id === cat.id)
    if (items.length > 0) groups.push({ type: 'category', category: cat, bookmarks: items })
  }
  const catIds = new Set((categories || []).map((c) => c.id))
  const uncategorized = list.filter((b) => !b.category_id || !catIds.has(b.category_id))
  if (uncategorized.length > 0) groups.push({ type: 'uncategorized', bookmarks: uncategorized })
  return groups
}

// 视图 → 分块数据：'all' 全量分组；'uncategorized'/数字 id 单块（无书签也出组，供块内空态）；未知 id 空数组
export function groupsForView(bookmarks, categories, activeCat) {
  if (activeCat === 'all') return groupBookmarksByCategory(bookmarks, categories)
  if (activeCat === 'uncategorized') {
    return [{ type: 'uncategorized', bookmarks: filterBookmarks(bookmarks, 'uncategorized') }]
  }
  const category = (categories || []).find((c) => c.id === activeCat)
  return category ? [{ type: 'category', category, bookmarks: filterBookmarks(bookmarks, category.id) }] : []
}
