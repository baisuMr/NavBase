// API 共享字段校验工具：统一类型校验与 URL 协议白名单，非法类型返回 400 而非落到 500

// 非空字符串（trim 后仍需非空，拦截纯空白输入）
export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// 可选字符串：允许缺省（undefined/null）或字符串
export function isOptionalString(v) {
  return v === undefined || v === null || typeof v === 'string';
}

// 可选正整数（分类 id 等，AUTOINCREMENT 自 1 起）
export function isOptionalPositiveInt(v) {
  return v === undefined || v === null || (Number.isInteger(v) && v > 0);
}

// 可选非负整数（sort_order 等，0 合法）
export function isOptionalNonNegInt(v) {
  return v === undefined || v === null || (Number.isInteger(v) && v >= 0);
}

// 书签载荷校验：返回错误消息，通过时返回 null
export function validateBookmarkPayload(data) {
  if (!isNonEmptyString(data?.title)) return '标题不能为空';
  if (!isNonEmptyString(data?.url)) return 'URL不能为空';
  let parsed;
  try {
    parsed = new URL(data.url);
  } catch {
    return 'URL格式不正确';
  }
  // 仅允许 http/https（拦截 javascript:、data: 等协议）
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '仅支持 http/https 链接';
  }
  if (!isOptionalString(data.description) || !isOptionalString(data.icon_url)) {
    return '描述与图标字段类型不正确';
  }
  if (!isOptionalPositiveInt(data.category_id)) return '分类ID类型不正确';
  if (!isOptionalNonNegInt(data.sort_order)) return '排序字段类型不正确';
  return null;
}

// 分类载荷校验：返回错误消息，通过时返回 null
export function validateCategoryPayload(data) {
  if (!isNonEmptyString(data?.name)) return '分类名称不能为空';
  if (!isOptionalString(data?.icon) || !isOptionalString(data?.color)) {
    return '图标与颜色字段类型不正确';
  }
  if (!isOptionalNonNegInt(data?.sort_order)) return '排序字段类型不正确';
  return null;
}
