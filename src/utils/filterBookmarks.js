// 书签按选中 tab 筛选：'all' 全部、'uncategorized' 未分类（category_id 为空）、数字 id 按分类
export function filterBookmarks(bookmarks, activeCat) {
  if (activeCat === 'all') return bookmarks
  if (activeCat === 'uncategorized') return bookmarks.filter((b) => !b.category_id)
  return bookmarks.filter((b) => b.category_id === activeCat)
}
