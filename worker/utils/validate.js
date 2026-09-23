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

// 头像 dataURL 白名单：仅允许前端压缩后的 png/jpeg/webp
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
// 网站名称长度上限
const MAX_SITE_NAME_LENGTH = 30;
// 头像 dataURL 长度上限（128×128 压缩后通常 <40KB，留足余量）
const MAX_AVATAR_LENGTH = 200 * 1024;

// 站点设置载荷校验：返回错误消息，通过时返回 null
// 约定：字段值为空字符串表示清除/恢复默认，缺省（undefined）表示不修改
export function validateSettingsPayload(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return '请求体格式不正确';
  }
  if (data.site_name !== undefined) {
    const name = data.site_name;
    if (name !== '' && !isNonEmptyString(name)) return '网站名称不能为空白';
    if (typeof name === 'string' && name.trim().length > MAX_SITE_NAME_LENGTH) {
      return `网站名称不能超过 ${MAX_SITE_NAME_LENGTH} 个字`;
    }
  }
  if (data.avatar !== undefined) {
    const avatar = data.avatar;
    if (typeof avatar !== 'string') return '头像数据类型不正确';
    if (avatar !== '') {
      if (!IMAGE_DATA_URL_RE.test(avatar)) return '头像仅支持 png/jpeg/webp 图片';
      if (avatar.length > MAX_AVATAR_LENGTH) return '头像图片过大，请更换图片后重试';
    }
  }
  return null;
}
