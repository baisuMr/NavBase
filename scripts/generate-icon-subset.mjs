// remixicon 图标子集再生成：扫描源码用到的 ri-* 图标类，裁剪 woff2 字体并生成精简 CSS
// 用法：node scripts/generate-icon-subset.mjs（新增图标后需重跑本脚本，否则新图标不显示）
// 输入：node_modules/remixicon/fonts/ 下的 remixicon.css 与 remixicon.ttf（类定义与字形的单一数据源）
// 输出：src/assets/fonts/remixicon-subset.woff2 + src/styles/remixicon-subset.css（随代码提交）
// 扫描范围（运行时/测试数据会出现图标类的位置）：
//   src/**/*.{vue,js}、schema.sql、migrations/*.sql、scripts/seed-test-data.sql
//   源码注释里出现的类名也会被收录（多收几个字形无害，漏收会导致图标不显示，故从宽）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RI_DIR = path.join(ROOT, 'node_modules/remixicon/fonts');
const FONT_OUT = path.join(ROOT, 'src/assets/fonts/remixicon-subset.woff2');
const CSS_OUT = path.join(ROOT, 'src/styles/remixicon-subset.css');

// 每行一条规则（与 schema.sql 同约束风格）：扫描脚本自身输出文件不参与扫描，避免自指
const SCAN_FILES = [
  'schema.sql',
  'scripts/seed-test-data.sql',
  ...fs.readdirSync(path.join(ROOT, 'migrations')).map(f => `migrations/${f}`).filter(f => f.endsWith('.sql'))
];

function* walk(dir, exts) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, exts);
    else if (exts.some(e => entry.name.endsWith(e))) yield full;
  }
}

function collectUsedClasses() {
  const used = new Set();
  const files = [...walk(path.join(ROOT, 'src'), ['.vue', '.js']), ...SCAN_FILES.map(f => path.join(ROOT, f))];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bri-[a-z0-9-]+/g)) used.add(m[0]);
  }
  return used;
}

// 解析 remixicon.css 的普通规则（selector { body }；@font-face 与注释跳过，基础选择器与
// 尺寸工具类无 :before 字形、一并保留；图标规则按用到的类过滤并收集 content 码点）
function parseRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    const body = m[2].trim();
    if (selector === '@font-face') continue;
    rules.push({ selector, body });
  }
  return rules;
}

function iconClassOf(selector) {
  // 图标规则形如 .ri-home-line:before（上游一类一条）；非图标规则返回 null
  const m = selector.match(/^\.ri-[a-z0-9-]+:before$/);
  return m ? selector.slice(1).replace(/:before$/, '') : null;
}

function codepointOf(body) {
  const m = body.match(/content:\s*"\\([0-9a-fA-F]+)"/);
  return m ? parseInt(m[1], 16) : null;
}

(async () => {
  const css = fs.readFileSync(path.join(RI_DIR, 'remixicon.css'), 'utf8');
  const used = collectUsedClasses();
  const rules = parseRules(css);

  const keptRules = [];
  const codepoints = new Set();
  const foundIcons = new Set();
  for (const rule of rules) {
    const iconClass = iconClassOf(rule.selector);
    if (!iconClass) {
      // 基础选择器与尺寸工具类（.ri-lg / .ri-fw / .ri-1x 等）原样保留
      keptRules.push(rule);
      continue;
    }
    if (!used.has(iconClass)) continue;
    const cp = codepointOf(rule.body);
    if (cp == null) continue; // 结构变化匹配不到码点：跳过该条（对应字形不会进子集）
    keptRules.push(rule);
    codepoints.add(cp);
    foundIcons.add(iconClass);
  }

  // 扫描到却不在上游 CSS 的类（拼写错误或占位示例）：提示但不中断
  for (const cls of [...used].sort()) {
    if (!foundIcons.has(cls) && !rules.some(r => !iconClassOf(r.selector) && r.selector.includes(cls))) {
      console.warn(`⚠ 未在 remixicon.css 中找到类：${cls}（拼写错误？）`);
    }
  }

  // 裁剪字体：仅保留用到的字形，输出 woff2（现代浏览器均支持）
  const ttf = fs.readFileSync(path.join(RI_DIR, 'remixicon.ttf'));
  const subset = await subsetFont(ttf, [...codepoints].map(cp => String.fromCodePoint(cp)).join(''), {
    targetFormat: 'woff2'
  });

  // 生成 CSS：自带 @font-face（本地子集 woff2）+ 原样保留的基础/工具类 + 用到的图标规则
  const iconRules = keptRules
    .filter(r => iconClassOf(r.selector))
    .sort((a, b) => a.selector.localeCompare(b.selector))
    .map(r => `${r.selector} { ${r.body} }`);
  const otherRules = keptRules
    .filter(r => !iconClassOf(r.selector))
    .map(r => `${r.selector} { ${r.body} }`);

  const outCss = [
    '/* remixicon 图标子集（由 scripts/generate-icon-subset.mjs 生成，勿手改）',
    '   新增图标后需重跑：node scripts/generate-icon-subset.mjs */',
    '@font-face {',
    "  font-family: 'remixicon';",
    "  src: url(../assets/fonts/remixicon-subset.woff2) format('woff2');",
    '  font-display: swap;',
    '}',
    ...otherRules,
    ...iconRules,
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(FONT_OUT), { recursive: true });
  fs.writeFileSync(FONT_OUT, subset);
  fs.writeFileSync(CSS_OUT, outCss);
  console.log(`✔ 图标子集：${foundIcons.size} 个图标，字体 ${(subset.length / 1024).toFixed(1)}KB`);
  console.log(`  ${path.relative(ROOT, FONT_OUT)}`);
  console.log(`  ${path.relative(ROOT, CSS_OUT)}`);
})();
