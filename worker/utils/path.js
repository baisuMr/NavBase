// 路径归一化：认证门与路由表共用同一实现，防止两套判断口径漂移产生绕过面
// 解码百分号编码、合并连续斜杠、去末尾斜杠（保留大小写，param 值不受影响）
export function normalizePath(pathname) {
  let path = pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // 畸形编码路径按原值参与匹配
  }
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

// 归一化（且调用方已小写化）后判断是否 API 路径：裸 /api 与 /api/ 变体一并覆盖，fail-closed
export function isApiPath(normalized) {
  return normalized === '/api' || normalized.startsWith('/api/');
}

// favicon 图片代理豁免判断（认证门放行、处理器自验 k 持证与 Sec-Fetch 来源）
export function isFaviconPath(normalized) {
  return normalized === '/api/favicon' || normalized.startsWith('/api/favicon/');
}
