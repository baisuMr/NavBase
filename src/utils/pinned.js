// 首屏常用站点：固定书签的选取逻辑
// 固定上限（与 worker/routes/bookmarks.js 的 MAX_PINNED 保持一致）
export const MAX_PINNED = 10

// 选出固定书签（is_pinned），按 sort_order 升序取前 limit 个；不修改传入数组
export function selectPinnedBookmarks(bookmarks, limit = MAX_PINNED) {
  return [...bookmarks]
    .filter(b => b.is_pinned)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .slice(0, limit)
}
