import { errorResponse, jsonResponse } from '../utils/http.js';
// 流式读取（与 favicon 共用）：只读前 MAX_HTML_BYTES 字节、提前取消剩余流，防异常大响应拖内存
import { readBytes } from '../utils/readBytes.js';
// 抓取（与 favicon 共用）：手动跟随重定向（≤3 跳）且跳转目标同样校验域名，防被目标站带到内网
import { fetchWithRedirects } from '../utils/fetch.js';
// 域名白名单（与 favicon 共用）：内网 IP / localhost / 单段主机名等一律不发起抓取
import { isAllowedDomain } from '../utils/domain.js';

// GET /api/page-meta?url=... - 抓取目标页 HTML 提取标题/描述（添加书签表单自动回填用）
// 普通 Basic Auth 认证门内端点（JSON 接口，非图片代理，无需 k 持证）
const MAX_HTML_BYTES = 256 * 1024; // 只读前 256KB（title/meta 声明集中在 head 区）
export const FETCH_TIMEOUT_MS = 5000; // 抓取硬超时，到点放弃并回空字段
const MAX_TITLE_LENGTH = 200; // 与入库上限（validate.js）一致，超出截断防保存校验失败
const MAX_DESCRIPTION_LENGTH = 2000;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 失败语义：抓取失败/非 HTML/超时统一 200 空字段（与 favicon 端点「失败不用 4xx」同一哲学）
function emptyResult() {
  return jsonResponse({ title: '', description: '' }, 200);
}

// 解码 HTML 字节：charset 取 Content-Type → meta 嗅探 → utf-8 逐级回退（GBK 中文站不乱码）
function detectCharset(contentTypeHeader, bytes) {
  const m = (contentTypeHeader || '').match(/charset\s*=\s*["']?([^\s;"']+)/i);
  if (m) return m[1];
  // latin1 解码头部只用于嗅探，任何字节序列都不会解码失败
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const meta = head.match(/<meta[^>]+charset\s*=\s*["']?([^\s"'>]+)/i);
  return meta ? meta[1] : 'utf-8';
}

function decodeHtml(bytes, contentTypeHeader) {
  const charset = detectCharset(contentTypeHeader, bytes);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// 常见 HTML 实体解码（命名集 + 数字引用），单遍替换避免二次解码
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, (whole, ref) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      // 排除代理区与越界码点，String.fromCodePoint 对其抛错
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[ref.toLowerCase()];
  });
}

// 按码点截断（不切断代理对），与入库长度上限对齐
function truncate(str, max) {
  const chars = Array.from(str);
  return chars.length <= max ? str : chars.slice(0, max).join('');
}

// 取标签属性值（双引号/单引号/无引号三种形态）
function attrValue(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4];
}

// 取 <meta> 的 content（按 name/property 匹配键，大小写不敏感）
function extractMetaContent(html, key) {
  const tagRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const id = (tag.match(/\b(?:name|property)\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (id.toLowerCase() !== key.toLowerCase()) continue;
    const content = attrValue(tag, 'content');
    if (content != null) return content;
  }
  return null;
}

// 文本规整：实体解码 + 空白折叠 + trim
function cleanText(s) {
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

// 标题优先 <title>，缺失/空白退 og:title
function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = m ? cleanText(m[1]) : '';
  if (title) return title;
  const og = extractMetaContent(html, 'og:title');
  return og ? cleanText(og) : '';
}

// 描述优先 meta description，缺失/空白退 og:description
function extractDescription(html) {
  const meta = extractMetaContent(html, 'description');
  const desc = meta ? cleanText(meta) : '';
  if (desc) return desc;
  const og = extractMetaContent(html, 'og:description');
  return og ? cleanText(og) : '';
}

export async function handle(request) {
  if (request.method !== 'GET') {
    return errorResponse('请求方法不支持', 'METHOD_NOT_ALLOWED', 405);
  }

  let rawUrl;
  try {
    rawUrl = new URL(request.url).searchParams.get('url');
  } catch {
    return errorResponse('URL格式不正确', 'VALIDATION_ERROR', 400);
  }
  if (!rawUrl || !rawUrl.trim()) {
    return errorResponse('URL不能为空', 'VALIDATION_ERROR', 400);
  }
  if (rawUrl.length > 2048) {
    return errorResponse('URL 不能超过 2048 个字符', 'VALIDATION_ERROR', 400);
  }
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return errorResponse('URL格式不正确', 'VALIDATION_ERROR', 400);
  }
  // 仅允许 http/https（与书签入库校验同规则）
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return errorResponse('仅支持 http/https 链接', 'VALIDATION_ERROR', 400);
  }
  // 域名白名单（与图标代理同口径）：只放行公网域名。抓取由云端发起，本就够不着调用方局域网，
  // 早拒绝省一次超时等待，也堵住借道探测内网的口子；内网书签标题由用户手动填写
  if (!isAllowedDomain(target.hostname.toLowerCase())) {
    return errorResponse('域名格式不合法', 'VALIDATION_ERROR', 400);
  }

  try {
    const res = await fetchWithRedirects(target.href, {
      timeout: FETCH_TIMEOUT_MS,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' }
    });
    if (!res.ok) return emptyResult();
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType && !contentType.includes('html')) return emptyResult();
    const bytes = await readBytes(res, MAX_HTML_BYTES);
    const html = decodeHtml(bytes, res.headers.get('content-type'));
    return jsonResponse({
      title: truncate(extractTitle(html), MAX_TITLE_LENGTH),
      description: truncate(extractDescription(html), MAX_DESCRIPTION_LENGTH)
    }, 200);
  } catch {
    return emptyResult();
  }
}
