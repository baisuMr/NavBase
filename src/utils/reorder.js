// 数组移位纯函数：把 from 下标元素移到 to 下标处，返回新数组（越界时返回副本不变）
export function moveInArray(list, from, to) {
  const next = [...list]
  if (
    !Number.isInteger(from) || !Number.isInteger(to) ||
    from < 0 || from >= next.length ||
    to < 0 || to >= next.length
  ) {
    return next
  }
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
