// worker/utils/imageType.js
// 图片内容定型：二进制魔数 + SVG 文本嗅探。不信任上游 content-type，输出类型只由字节决定

const IMAGE_MAGIC = [
  { sig: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { sig: [0x47, 0x49, 0x46], mime: 'image/gif' },
  { sig: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { sig: [0x42, 0x4d], mime: 'image/bmp' },
  { sig: [0x00, 0x00, 0x01, 0x00], mime: 'image/x-icon' },
  { sig: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }
];

// 按魔数返回强制 MIME；非魔数走 SVG 文本嗅探；均不符返回 null 拒收
export function detectImageType(buffer) {
  const bytes = new Uint8Array(buffer);
  const head = bytes.subarray(0, Math.min(12, bytes.byteLength));
  const hit = IMAGE_MAGIC.find(({ sig }) => sig.every((byte, i) => head[i] === byte));
  if (hit) return hit.mime;

  // UTF-16 BOM：按 UTF-8 解码会变乱码、危险扫描失效，直接拒
  if ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff)) return null;

  return isSvgText(bytes) ? 'image/svg+xml' : null;
}

function isSvgText(bytes) {
  const text = new TextDecoder('utf-8').decode(bytes);
  // 跳过 UTF-8 BOM（用 charCodeAt 判定，避免正则里嵌不可见字符）
  const noBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const window512 = noBom.trimStart().slice(0, 512).toLowerCase();
  if (!window512.startsWith('<svg') && !window512.startsWith('<?xml')) return false;
  // HTML 文档也可能内嵌 <svg>，靠根声明区分
  if (window512.includes('<html') || window512.includes('<!doctype html')) return false;
  return window512.includes('<svg');
}

// SVG 危险构造（命中任一即整份拒绝——可疑就拒，不剥离、不「净化后使用」）
const SVG_DANGER_PATTERNS = [
  { name: 'script', re: /<\s*script/i },
  { name: 'event', re: /\son[a-z]+\s*=/i },
  { name: 'foreignObject', re: /<\s*foreignobject/i },
  { name: 'javascript-url', re: /javascript\s*:/i },
  { name: 'data-html', re: /data\s*:\s*text\/html/i },
  { name: 'doctype', re: /<!\s*(doctype|entity)/i }
];

export function findSvgDanger(text) {
  const hit = SVG_DANGER_PATTERNS.find(({ re }) => re.test(text));
  return hit ? hit.name : null;
}

// 探测源统一入口：定型 +（SVG 时）危险检测，任一不过按无效图片拒收
export function acceptImageType(buffer) {
  const mime = detectImageType(buffer);
  if (!mime) return null;
  if (mime === 'image/svg+xml') {
    const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
    if (findSvgDanger(text)) return null;
  }
  return mime;
}
