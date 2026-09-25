// 按固定尺寸切块（批量导入上限 500/批，由调用方约定尺寸）
export function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
