// 统一 JSON 响应形状：错误结构 { error, code } 只在此定义，各路由共用，避免口径漂移
export function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

export function errorResponse(error, code, status, headers) {
  return jsonResponse({ error, code }, status, headers);
}

// 未配置 ADMIN_PASSWORD 的统一拒绝（认证门 / 登录 / favicon 三处共用语义）
export function notConfiguredError(headers) {
  return errorResponse('服务器未配置 ADMIN_PASSWORD', 'NOT_CONFIGURED', 500, headers);
}
