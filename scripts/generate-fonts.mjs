// 字体本地化生成脚本：请求 Google Fonts 子集 CSS，下载 woff2，重写 src/styles/fonts.css
// 用法：node scripts/generate-fonts.mjs（需可访问 fonts.googleapis.com）
// 维护约定：模板中新引入 Material Symbols 图标名后，必须补入 ICON_NAMES 并重跑本脚本
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src/assets/fonts');
const CSS_OUT = path.join(ROOT, 'src/styles/fonts.css');

// 项目实际使用的图标名（静态模板 + symbolMap + ContextMenu/插值）
const ICON_NAMES = [
  'add','add_a_photo','alternate_email','analytics','apps','arrow_forward','arrow_outward',
  'bookmark_heart','bookmarks','build','business','chat','check_circle','close','cloud',
  'content_copy','dark_mode','delete','download','edit','favorite','filter_alt','folder',
  'group','home','keyboard_double_arrow_down','light_mode','lightbulb','link','local_fire_department',
  'lock','logout','menu_book','music_note','palette','payments','person','photo_camera',
  'public','push_pin','rocket_launch','search','settings','sports_esports','star','terminal',
  'upload','visibility','visibility_off'
].sort();

const FAMILIES = [
  'JetBrains+Mono:wght@400;500',
  'Plus+Jakarta+Sans:wght@400;500;600',
  'Space+Grotesk:wght@300;400;500;600'
];

async function fetchCss(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS ${res.status}: ${url}`);
  return res.text();
}

async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf.length;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let allCss = '';

  // 1. 图标子集（保留可变轴，FILL 1 在 layout.css 中使用）
  const iconUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${ICON_NAMES.join(',')}&display=block`;
  const iconCss = await fetchCss(iconUrl);
  console.log('图标子集 CSS 获取成功,', iconCss.length, '字节');

  // 2. 正文字体（latin + latin-ext 子集；中文由系统字体回退，Google 家族本无中文字形）
  let bodyCss = '';
  for (const fam of FAMILIES) {
    bodyCss += await fetchCss(`https://fonts.googleapis.com/css2?family=${fam}&display=swap`) + '\n';
  }

  // 3. 正文字体只保留 latin / latin-ext 块
  const blocks = bodyCss.split(/\n(?=\/\*)/).filter(b => /^\/\*\s*(latin|latin-ext)\s*\*\//.test(b.trim()));
  console.log('正文 @font-face 块（latin/latin-ext）:', blocks.length);
  allCss = '/* Material Symbols 图标字体（icon_names 子集，含可变轴 FILL/opsz/wght/GRAD） */\n' + iconCss + '\n/* 正文字体（latin/latin-ext 子集，中文回退系统字体） */\n' + blocks.join('\n') + '\n';

  // 4. 提取全部字体 URL 并下载，重写 CSS 指向本地
  // 注意：图标子集走 /l/font?kit= 动态端点，URL 不带 .woff2 后缀，不能按后缀过滤
  const urls = [...allCss.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
  const seen = new Map();
  let i = 0;
  for (const url of urls) {
    if (seen.has(url)) continue;
    const isIcon = /materialsymbols|\/l\/font\?/.test(url);
    const label = isIcon ? 'material-symbols-subset' : url.match(/\/s\/([a-z0-9]+)\//i)?.[1] || 'font';
    const file = `${label}-${++i}.woff2`;
    const size = await download(url, path.join(OUT_DIR, file));
    allCss = allCss.split(url).join(`../assets/fonts/${file}`);
    seen.set(url, file);
    console.log(`  ${file}  ${(size / 1024).toFixed(1)} KB`);
  }
  console.log(`共下载 ${seen.size} 个字体文件`);

  // 5. 校验：CSS 中不得残留远程字体引用
  const remote = allCss.match(/url\((https:[^)]+)\)/);
  if (remote) throw new Error(`仍存在远程字体引用: ${remote[1]}`);

  fs.writeFileSync(CSS_OUT, allCss);
  console.log('fonts.css 已生成:', CSS_OUT);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
