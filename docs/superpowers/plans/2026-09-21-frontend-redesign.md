# NavManager 前端重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 NavManager 前端整体重设计为 stitch_1 参考稿的 Tabular Minimalist 风格（纯浅色、扁平、Slate + 皇家蓝）。

**Architecture:** 先一次性重写四个 CSS 文件（token + 全局 + 组件 + 布局），再逐组件重写模板引用新类名；数据层（stores/composables/api）仅认证逻辑改动；首屏时钟/搜索/快捷卡片内联进 Home.vue，删除 hero 组件目录与 useTheme。

**Tech Stack:** Vue 3 + JavaScript、Pinia、Vite、Vitest、纯 CSS、Cloudflare Pages Functions。

**Spec:** `docs/superpowers/specs/2026-09-21-frontend-redesign-design.md`

## Global Constraints

- 所有命令在 `E:\mzheng\网址导航工具\nav-manager` 目录下执行（pnpm）。
- 不使用 TypeScript、不使用 CSS 框架（Tailwind 等），纯 CSS。
- 图标一律 remixicon（`ri-*` class），不引入 Material Symbols / 内联 SVG。
- 前端不直接 fetch，一律走 `src/api/` 封装或现有 store/composable（认证 store 的 login fetch 为现状保留）。
- 新 CSS 只保留浅色主题，禁止出现 `data-theme`、`prefers-color-scheme` 深色分支、玻璃拟态（backdrop-filter）、彩色辉光、多段大阴影。
- 组件接口（props/emits）尽量不变：Modal、ContextMenu、ToastMessage、IconPicker、ColorPicker、BookmarkForm、CategoryForm、SettingsPanel 的对外接口保持原样。
- Git 提交信息：中文、`类型: 描述`（feat/fix/docs/refactor/test/chore）、动词开头、≤50 字、不加句号。
- 每任务结束必须 `pnpm test` 与 `pnpm build` 双绿才能提交。

## 文件结构总览

```
src/
├── views/
│   ├── Home.vue            # 重写：顶栏接线 + 内联首屏（时钟/搜索/快捷卡片）+ 第二屏接线 + 页脚 + 弹窗
│   └── Login.vue           # 重写：参考稿登录卡（记住设备）
├── components/
│   ├── layout/AppHeader.vue        # 重写：logo + ? + 设置 + 头像
│   ├── bookmark/BookmarkExplorer.vue  # 重写：分类 tabs + 添加网址 + 网格（删筛选框）
│   ├── bookmark/BookmarkCard.vue      # 重写模板（类名换新）
│   ├── bookmark/BookmarkForm.vue      # 小改：图标预览 inline style → class
│   ├── category/CategoryForm.vue      # 小改：footer inline style 清理
│   ├── common/ShortcutHelp.vue        # 新增：快捷键帮助弹窗
│   ├── common/SettingsPanel.vue       # 改：删「外观」区与 useTheme
│   ├── common/Modal.vue               # 不变（类名兼容）
│   ├── common/ContextMenu.vue         # 不变（类名兼容）
│   ├── common/ToastMessage.vue        # 不变（类名兼容）
│   ├── common/IconPicker.vue          # 不变（类名兼容）
│   └── common/ColorPicker.vue         # 不变（类名兼容）
├── composables/useTheme.js            # 删除
├── stores/auth.js                     # 改：remember 存储分流
├── styles/                            # 四个文件全部重写（见 Task 2）
└── main.js                            # 改：删除 useTheme 副作用 import
functions/api/auth/login.js            # 改：remember 参数
wrangler.toml                          # 改：新增 REMEMBER_DURATION_DAYS
scripts/generate-fonts.mjs             # 改：FAMILIES 换 Inter
```

---

### Task 1: 正文字体切换为 Inter

**Files:**
- Modify: `scripts/generate-fonts.mjs:13-17`
- Modify: `src/styles/fonts.css`（脚本生成）
- Delete: `src/assets/fonts/plusjakartasans-3.woff2`、`plusjakartasans-4.woff2`、`spacegrotesk-5.woff2`、`spacegrotesk-6.woff2`

**Interfaces:**
- Consumes: 无
- Produces: `fonts.css` 含 `font-family: 'Inter'`（400/500/600）与 `JetBrains Mono`（400/500）；后续 Task 2 的 `--font-sans` 依赖此字体名。

- [ ] **Step 1: 修改 FAMILIES 配置**

将 `scripts/generate-fonts.mjs` 第 13-17 行的 FAMILIES 数组替换为：

```js
const FAMILIES = [
  'JetBrains+Mono:wght@400;500',
  'Inter:wght@400;500;600'
];
```

- [ ] **Step 2: 运行生成脚本**

Run: `node scripts/generate-fonts.mjs`
Expected: 输出「fonts.css 已生成: …」且无报错。

- [ ] **Step 3: 验证生成结果**

Run: `grep -c "font-family: 'Inter'" src/styles/fonts.css`
Expected: 输出 ≥ 6（3 个字重 × latin/latin-ext 两个子集）。
若脚本因网络失败（fonts.googleapis.com 不可访问）：**停止本任务**，`git checkout scripts/generate-fonts.mjs` 还原，向用户报告并询问是否走回退方案（保留现有字体）。不得自行改用回退继续。

- [ ] **Step 4: 删除不再引用的旧字体文件**

Run:

```bash
rm src/assets/fonts/plusjakartasans-3.woff2 src/assets/fonts/plusjakartasans-4.woff2 src/assets/fonts/spacegrotesk-5.woff2 src/assets/fonts/spacegrotesk-6.woff2
```

- [ ] **Step 5: 构建与测试验证**

Run: `pnpm build && pnpm test`
Expected: build 成功、全部测试通过。

- [ ] **Step 6: 提交**

```bash
git add scripts/generate-fonts.mjs src/styles/fonts.css src/assets/fonts
git commit -m "chore: 正文字体切换为 Inter"
```

---

### Task 2: 设计 token 与四件套 CSS 全量重写

**Files:**
- Modify: `src/styles/variables.css`（整文件重写）
- Modify: `src/styles/global.css`（整文件重写）
- Modify: `src/styles/layout.css`（整文件重写）
- Modify: `src/styles/components.css`（整文件重写）
- Modify: `src/main.js`（删除 useTheme import 一行）

**Interfaces:**
- Consumes: Task 1 的 Inter 字体；现有模板的类名（本任务定义的类名与旧模板类名尽量同名，见各文件注释）。
- Produces: 全部新类名与 token。后续任务模板**必须**使用下列类名，不得自创：`.app-header*`、`.hero*`、`.badge*`、`.kbd`、`.favicon-fallback`、`.explorer*`、`.category-tab*`、`.bookmark-card*`、`.bookmark-empty`、`.app-footer*`、`.login-*`、`.loading-state`、`.modal*`、`.context-menu*`、`.toast*`、`.btn*`、`.form-*`、`.input/.textarea/.select`、`.settings-*`、`.icon-picker/.icon-item`、`.color-picker/.color-item`、`.shortcut-*`、`.form-icon-preview*`。
- 注意：本任务完成后旧模板仍引用旧类（首屏、书签区等旧类不再有样式），页面视觉暂时破损，属计划内中间态，由 Task 4-8 逐个恢复。

- [ ] **Step 1: 重写 variables.css**

用 Write 整文件替换为：

```css
/* ── 设计系统：Tabular Minimalist ──
   规范约定：
   - 纯浅色单主题，无深色分支；扁平无阴影（仅两级微阴影）
   - 中性色一律 Slate 系，主色皇家蓝；禁止玻璃拟态/辉光/渐变
   - 间距遵循 4px 网格
   - 图标尺寸走 --icon-size-* 阶梯 */
:root {
  color-scheme: light;

  /* Surface — Slate 系 */
  --color-surface: #F8FAFC;
  --color-surface-card: #FFFFFF;
  --color-surface-muted: #F1F5F9;

  /* 边框 */
  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E1;
  --color-border-active: #94A3B8;

  /* On-Surface — 文字层级 */
  --color-text: #0F172A;
  --color-text-secondary: #334155;
  --color-text-muted: #64748B;
  --color-text-disabled: #94A3B8;

  /* Primary — Royal Blue */
  --color-primary: #2563EB;
  --color-on-primary: #FFFFFF;
  --color-primary-hover: #1D4ED8;
  --color-primary-active: #1E40AF;
  --color-primary-soft: #EFF6FF;
  --color-primary-soft-border: #BFDBFE;
  --color-primary-ring: rgba(37, 99, 235, 0.15);

  /* 语义色 */
  --color-success: #059669;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-error-hover: #B91C1C;
  --color-error-soft: #FEF2F2;

  /* 弹窗遮罩（无模糊） */
  --color-overlay: rgba(15, 23, 42, 0.4);

  /* 阴影 — 仅两级：卡片 hover / 弹窗与下拉 */
  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-pop: 0 2px 4px rgba(15, 23, 42, 0.06), 0 12px 32px -8px rgba(15, 23, 42, 0.12);

  /* 圆角 */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-icon: 8px;

  /* 间距 — 4px 网格 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;

  /* 字体（西文品牌字 + 中文回退链） */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'PingFang SC', 'Microsoft YaHei', monospace;

  /* 字号阶梯 */
  --fs-hero-clock: clamp(64px, 12vw, 128px);
  --fs-hero-clock-sec: clamp(28px, 4vw, 40px);
  --fs-title: 24px;
  --fs-body-lg: 16px;
  --fs-body-md: 14px;
  --fs-body-sm: 13px;
  --fs-card: 12px;
  --fs-label-sm: 11px;
  --fs-count: 10px;

  /* 字重 */
  --fw-medium: 500;
  --fw-semibold: 600;

  /* 图标尺寸阶梯 */
  --icon-size-sm: 12px;
  --icon-size-md: 14px;
  --icon-size-lg: 16px;
  --icon-size-xl: 24px;

  /* 过渡 */
  --t-fast: 150ms ease;
  --t-base: 250ms ease;

  /* 布局 */
  --header-height: 56px;
  --content-max-width: 1024px;
  --hero-max-width: 896px;
  --search-max-width: 672px;

  /* select 下拉箭头 */
  --select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235a6169' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
}
```

- [ ] **Step 2: 重写 global.css**

用 Write 整文件替换为：

```css
@import './variables.css';
@import './components.css';
@import './layout.css';

/* ── Reset ── */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: var(--fs-body-md);
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
}

body {
  font-family: var(--font-sans);
  font-size: var(--fs-body-md);
  color: var(--color-text);
  background-color: var(--color-surface);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  overflow-x: hidden;
}

#app {
  position: relative;
}

a {
  color: inherit;
  text-decoration: none;
  transition: color var(--t-fast);
}

a:hover {
  color: var(--color-primary);
}

ul, ol {
  list-style: none;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
}

input, textarea, select {
  font-family: inherit;
  color: inherit;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 100px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-active);
}

::selection {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Remix Icon ── */
[class^="ri-"] {
  user-select: none;
}

/* ── 通用原子：键盘键帽 ── */
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  font-family: var(--font-mono);
  font-size: var(--fs-label-sm);
  font-weight: var(--fw-medium);
  color: var(--color-text-muted);
  background-color: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  user-select: none;
}

/* ── 通用原子：徽章 ── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: var(--fs-label-sm);
  font-weight: var(--fw-semibold);
  border-radius: var(--radius-xs);
  line-height: 16px;
}

.badge-primary {
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
  border: 1px solid var(--color-primary-soft-border);
}

.badge-mono {
  font-family: var(--font-mono);
  font-weight: var(--fw-medium);
  color: var(--color-text-secondary);
  background-color: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

/* ── favicon 回退：标题首字头像 ── */
.favicon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: var(--fs-card);
  font-weight: var(--fw-semibold);
  color: var(--color-text-secondary);
  background-color: var(--color-surface-muted);
}

/* ── 全局动画 ── */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounceDown {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}

/* ── 动效减弱偏好 ── */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: 重写 layout.css**

用 Write 整文件替换为：

```css
/* ═══ 页面级布局：顶栏 / 首屏 / 书签库 / 页脚 / 登录页 ═══ */

/* ── 顶栏 ── */
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--header-height);
  background-color: var(--color-surface-card);
  border-bottom: 1px solid var(--color-border);
}

.app-header-inner {
  max-width: var(--content-max-width);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text);
}

.app-header-brand:hover {
  color: var(--color-text);
}

.app-header-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--color-on-primary);
  font-size: var(--icon-size-lg);
}

.app-header-name {
  font-size: var(--fs-body-md);
  font-weight: var(--fw-semibold);
  letter-spacing: -0.01em;
}

.app-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.app-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--color-text-muted);
  border-radius: var(--radius-xs);
  font-size: var(--icon-size-lg);
  transition: all var(--t-fast);
}

.app-header-btn:hover {
  color: var(--color-text);
  background-color: var(--color-surface-muted);
}

.app-header-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--color-text);
  color: var(--color-on-primary);
  font-size: var(--fs-card);
  font-weight: var(--fw-semibold);
  overflow: hidden;
  user-select: none;
}

.app-header-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── 首屏 Hero（点阵底 + 垂直居中） ── */
.hero {
  position: relative;
  min-height: calc(100vh - var(--header-height));
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: var(--color-surface);
  background-image: radial-gradient(var(--color-border-strong) 1.2px, transparent 1.2px);
  background-size: 24px 24px;
}

.hero-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: var(--hero-max-width);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
}

/* 时钟 */
.hero-clock {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: var(--space-lg);
  font-family: var(--font-mono);
  font-weight: var(--fw-semibold);
  line-height: 1;
  color: var(--color-text);
  letter-spacing: -0.02em;
  user-select: none;
}

.hero-clock-hm {
  font-size: var(--fs-hero-clock);
}

.hero-clock-sec {
  font-size: var(--fs-hero-clock-sec);
  font-weight: var(--fw-medium);
  color: var(--color-text-disabled);
}

/* 日期行 */
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: var(--space-2xl);
  font-size: var(--fs-body-sm);
  color: var(--color-text-muted);
  user-select: none;
}

.hero-meta-date {
  font-weight: var(--fw-medium);
  color: var(--color-text-secondary);
}

.hero-meta-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--color-border-strong);
  font-size: 0;
}

/* 搜索 */
.hero-search {
  position: relative;
  width: 100%;
  max-width: var(--search-max-width);
  margin: 0 auto;
}

.hero-search-box {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: all var(--t-fast);
}

.hero-search-box:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-ring);
}

/* 引擎下拉 */
.hero-search-engine-wrap {
  position: relative;
  flex-shrink: 0;
}

.hero-search-engine {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-surface-muted);
  border-radius: var(--radius-md);
  font-size: var(--fs-body-sm);
  font-weight: var(--fw-medium);
  color: var(--color-text-secondary);
  transition: background-color var(--t-fast);
}

.hero-search-engine:hover {
  background-color: var(--color-border);
}

.hero-search-engine i {
  font-size: var(--icon-size-sm);
  color: var(--color-text-disabled);
}

.hero-search-engine-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.hero-search-engine-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  min-width: 128px;
  padding: var(--space-xs);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-pop);
  animation: scaleIn var(--t-fast);
}

.hero-search-engine-item {
  display: block;
  width: 100%;
  padding: 6px var(--space-md);
  border-radius: var(--radius-xs);
  font-size: var(--fs-body-sm);
  color: var(--color-text-secondary);
  text-align: left;
  transition: background-color var(--t-fast);
}

.hero-search-engine-item:hover {
  background-color: var(--color-surface-muted);
  color: var(--color-text);
}

.hero-search-engine-item.active {
  color: var(--color-primary);
  font-weight: var(--fw-medium);
}

/* 输入区 */
.hero-search-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.hero-search-field > i {
  font-size: var(--icon-size-lg);
  color: var(--color-text-disabled);
  flex-shrink: 0;
}

.hero-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-body-md);
  color: var(--color-text);
}

.hero-search-input::placeholder {
  color: var(--color-text-disabled);
}

.hero-search-kbd {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

/* 站内结果下拉 */
.hero-search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  padding: var(--space-xs);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
  animation: slideUp var(--t-fast);
}

.hero-search-result {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  color: inherit;
  transition: background-color var(--t-fast);
}

.hero-search-result:hover {
  background-color: var(--color-surface-muted);
  color: inherit;
}

.hero-search-result-favicon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background-color: var(--color-surface-muted);
}

.hero-search-result-favicon img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.hero-search-result-info {
  flex: 1;
  min-width: 0;
}

.hero-search-result-title {
  display: block;
  font-size: var(--fs-body-sm);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-search-result-url {
  display: block;
  font-size: var(--fs-card);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-search-engine-hint,
.hero-search-empty {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border);
  font-size: var(--fs-card);
  color: var(--color-text-muted);
}

.hero-search-engine-hint {
  margin-top: var(--space-xs);
}

/* 常用站点（排序前 5） */
.hero-favorites {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  margin-top: var(--space-lg);
  user-select: none;
}

.hero-fav-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: inherit;
  transition: all var(--t-fast);
}

.hero-fav-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card);
  color: inherit;
}

.hero-fav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-icon);
  background-color: var(--color-surface-muted);
}

.hero-fav-icon img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.hero-fav-name {
  font-size: var(--fs-card);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--t-fast);
}

.hero-fav-card:hover .hero-fav-name {
  color: var(--color-primary);
}

/* 滚动提示 */
.hero-scroll-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding-bottom: var(--space-xl);
  font-size: var(--fs-label-sm);
  font-weight: var(--fw-medium);
  letter-spacing: 0.04em;
  color: var(--color-text-disabled);
  transition: color var(--t-fast);
}

.hero-scroll-hint:hover {
  color: var(--color-primary);
}

.hero-scroll-hint i {
  font-size: var(--icon-size-lg);
  animation: bounceDown 2s infinite;
}

/* 首屏响应式 */
@media (max-width: 1023px) {
  .hero-favorites {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .hero-favorites {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-search-kbd {
    display: none;
  }
}

/* ── 第二屏：书签库 ── */
.explorer {
  min-height: 100vh;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-2xl) var(--space-lg);
}

.explorer-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-bottom: var(--space-lg);
  margin-bottom: var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px var(--space-md);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--fs-card);
  font-weight: var(--fw-medium);
  color: var(--color-text-secondary);
  white-space: nowrap;
  transition: all var(--t-fast);
}

.category-tab:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.category-tab.active {
  background-color: var(--color-text);
  border-color: var(--color-text);
  color: var(--color-on-primary);
}

.category-tab-count {
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: var(--fs-count);
  background-color: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.category-tab.active .category-tab-count {
  background-color: var(--color-text-secondary);
  color: var(--color-border);
}

.category-tab-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-disabled);
  background-color: var(--color-surface-card);
  transition: all var(--t-fast);
}

.category-tab-add:hover {
  color: var(--color-text-secondary);
  border-color: var(--color-border-strong);
}

.explorer-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px var(--space-md);
  background-color: var(--color-primary);
  border-radius: var(--radius-icon);
  font-size: var(--fs-card);
  font-weight: var(--fw-medium);
  color: var(--color-on-primary);
  transition: all var(--t-fast);
}

.explorer-add-btn:hover {
  background-color: var(--color-primary-hover);
  color: var(--color-on-primary);
}

.explorer-add-btn:active {
  transform: scale(0.98);
  background-color: var(--color-primary-active);
}

.explorer-add-btn i {
  font-size: var(--icon-size-md);
}

/* 书签网格 */
.bookmark-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 1023px) {
  .bookmark-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .bookmark-grid {
    grid-template-columns: 1fr;
  }
}

.bookmark-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-width: 0;
  padding: var(--space-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: inherit;
  transition: all var(--t-fast);
}

.bookmark-card:hover {
  background-color: var(--color-surface-card);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card);
  transform: translateY(-2px);
  color: inherit;
}

.bookmark-card-favicon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-icon);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
}

.bookmark-card-favicon img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.bookmark-card-info {
  flex: 1;
  min-width: 0;
}

.bookmark-card-title {
  display: block;
  font-size: var(--fs-card);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--t-fast);
}

.bookmark-card:hover .bookmark-card-title {
  color: var(--color-primary);
}

.bookmark-card-domain {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: var(--fs-card);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-card-arrow {
  flex-shrink: 0;
  font-size: var(--icon-size-md);
  color: var(--color-border-strong);
  transition: all var(--t-fast);
}

.bookmark-card:hover .bookmark-card-arrow {
  color: var(--color-primary);
  transform: translate(2px, -2px);
}

.bookmark-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-2xl) 0;
  color: var(--color-text-muted);
  font-size: var(--fs-body-sm);
}

.bookmark-empty i {
  font-size: var(--icon-size-xl);
  color: var(--color-border-strong);
}

/* ── 页脚 ── */
.app-footer {
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface-card);
}

.app-footer-inner {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-lg);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--fs-body-sm);
  color: var(--color-text-muted);
}

.app-footer-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.app-footer-site {
  font-weight: var(--fw-medium);
  color: var(--color-text-secondary);
}

.app-footer-links {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.app-footer-links button {
  font-size: var(--fs-body-sm);
  color: var(--color-text-muted);
  transition: color var(--t-fast);
}

.app-footer-links button:hover {
  color: var(--color-primary);
}

.app-footer-version {
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--fs-card);
  font-weight: var(--fw-medium);
  color: var(--color-text-muted);
  background-color: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  user-select: none;
}

/* ── 登录页 ── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background-color: var(--color-surface);
}

.login-card {
  width: 100%;
  max-width: 440px;
  padding: var(--space-xl);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
}

@media (min-width: 640px) {
  .login-card {
    padding: 40px;
  }
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  text-align: center;
}

.login-brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background-color: var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-on-primary);
  font-size: var(--icon-size-xl);
}

.login-brand-title {
  font-size: var(--fs-title);
  font-weight: var(--fw-semibold);
  letter-spacing: -0.015em;
  color: var(--color-text);
}

.login-brand-subtitle {
  font-size: var(--fs-body-sm);
  color: var(--color-text-muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login-label {
  font-size: var(--fs-body-sm);
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.login-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.login-input {
  width: 100%;
  height: 40px;
  padding: 0 var(--space-md);
  background-color: var(--color-surface-muted);
  border: none;
  border-radius: var(--radius-md);
  outline: none;
  font-size: var(--fs-body-md);
  color: var(--color-text);
  transition: all var(--t-fast);
}

.login-input::placeholder {
  color: var(--color-text-disabled);
}

.login-input:focus {
  background-color: var(--color-surface-card);
  box-shadow: 0 0 0 2px var(--color-primary-ring);
}

.login-input.has-password {
  padding-right: 40px;
}

.login-password-toggle {
  position: absolute;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs);
  color: var(--color-text-disabled);
  border-radius: var(--radius-xs);
  font-size: 18px;
  transition: color var(--t-fast);
}

.login-password-toggle:hover {
  color: var(--color-text);
}

/* 记住设备（隐藏原生 input，用相邻兄弟自定义勾选框） */
.login-remember {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
  cursor: pointer;
  user-select: none;
}

.login-remember input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.login-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-xs);
  color: var(--color-on-primary);
  font-size: 12px;
  transition: all var(--t-fast);
}

.login-remember input:checked + .login-checkbox {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.login-remember-text {
  font-size: var(--fs-body-sm);
  color: var(--color-text-secondary);
}

.login-error {
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-error-soft);
  border-radius: var(--radius-sm);
  font-size: var(--fs-card);
  color: var(--color-error);
}

.login-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  width: 100%;
  height: 40px;
  margin-top: var(--space-xs);
  background-color: var(--color-primary);
  border-radius: var(--radius-md);
  font-size: var(--fs-body-sm);
  font-weight: var(--fw-medium);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-card);
  transition: all var(--t-fast);
}

.login-submit:hover {
  background-color: var(--color-primary-hover);
}

.login-submit:active {
  transform: scale(0.98);
}

.login-submit:disabled {
  cursor: default;
  opacity: 0.8;
}

.login-submit i {
  font-size: 18px;
}

.login-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: var(--color-on-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── 加载状态 ── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-2xl) 0;
  color: var(--color-text-muted);
  font-size: var(--fs-body-sm);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-primary-soft-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

- [ ] **Step 4: 重写 components.css**

用 Write 整文件替换为：

```css
/* ═══ 通用组件：按钮 / 表单 / 弹窗 / 菜单 / Toast / 设置 / 选择器 ═══ */

/* ── 按钮 ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 var(--space-lg);
  border-radius: var(--radius-sm);
  font-size: var(--fs-body-sm);
  font-weight: var(--fw-medium);
  border: 1px solid transparent;
  transition: all var(--t-fast);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: var(--color-surface-card);
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-surface-muted);
  border-color: var(--color-border-strong);
}

.btn-ghost {
  color: var(--color-text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-surface-muted);
  color: var(--color-text);
}

.btn-danger {
  background-color: var(--color-error);
  color: var(--color-on-primary);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-hover);
}

/* ── 表单控件 ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: var(--space-lg);
}

.form-label {
  font-size: var(--fs-body-sm);
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.input,
.textarea,
.select {
  width: 100%;
  padding: 8px var(--space-md);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  outline: none;
  font-size: var(--fs-body-md);
  color: var(--color-text);
  transition: all var(--t-fast);
}

.input:focus,
.textarea:focus,
.select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-ring);
}

.input::placeholder,
.textarea::placeholder {
  color: var(--color-text-disabled);
}

.textarea {
  resize: vertical;
  min-height: 60px;
}

.select {
  appearance: none;
  background-image: var(--select-arrow);
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.form-hint {
  font-size: var(--fs-card);
  color: var(--color-text-muted);
}

.form-error {
  font-size: var(--fs-card);
  color: var(--color-error);
}

.form-icon-preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.form-icon-preview {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  object-fit: contain;
  background-color: var(--color-surface-muted);
  padding: 4px;
  flex-shrink: 0;
}

/* ── 弹窗 ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px var(--space-lg) var(--space-lg);
  background-color: var(--color-overlay);
  animation: fadeIn var(--t-fast);
  overflow-y: auto;
}

.modal {
  width: 100%;
  max-width: 480px;
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border-active);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
  animation: scaleIn var(--t-fast);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  font-size: var(--fs-body-lg);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs);
  color: var(--color-text-muted);
  font-size: var(--icon-size-lg);
  transition: all var(--t-fast);
}

.modal-close:hover {
  background-color: var(--color-surface-muted);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-xl);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-xl);
}

/* ── 右键菜单 ── */
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.context-menu {
  position: fixed;
  z-index: 91;
  min-width: 160px;
  padding: var(--space-xs);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-pop);
  animation: scaleIn var(--t-fast);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 7px var(--space-md);
  border-radius: var(--radius-xs);
  font-size: var(--fs-body-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--t-fast);
}

.context-menu-item:hover {
  background-color: var(--color-surface-muted);
  color: var(--color-text);
}

.context-menu-item i {
  font-size: var(--icon-size-lg);
  color: var(--color-text-muted);
}

.context-menu-item.danger {
  color: var(--color-error);
}

.context-menu-item.danger:hover {
  background-color: var(--color-error-soft);
  color: var(--color-error);
}

.context-menu-item.danger i {
  color: inherit;
}

.context-menu-divider {
  height: 1px;
  margin: var(--space-xs) var(--space-sm);
  background-color: var(--color-border);
}

/* ── Toast ── */
.toast {
  position: fixed;
  top: calc(var(--header-height) + var(--space-lg));
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px var(--space-lg);
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-pop);
  font-size: var(--fs-body-sm);
  color: var(--color-text);
}

.toast::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast.success::before {
  background-color: var(--color-success);
}

.toast.error::before {
  background-color: var(--color-error);
}

.toast.warning::before {
  background-color: var(--color-warning);
}

.toast.info::before {
  background-color: var(--color-primary);
}

.toast-enter-active,
.toast-leave-active {
  transition: all var(--t-base);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

/* ── 设置面板 ── */
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.settings-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.settings-avatar-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-surface-muted);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.settings-avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.settings-avatar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.settings-data-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.settings-username {
  font-size: var(--fs-body-md);
  color: var(--color-text-secondary);
}

/* ── 图标选择器 ── */
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--icon-size-lg);
  cursor: pointer;
  transition: all var(--t-fast);
}

.icon-item:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.icon-item.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

/* ── 颜色选择器 ── */
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.color-item {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--t-fast);
}

.color-item:hover {
  transform: scale(1.1);
}

.color-item.active {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-surface-card) inset;
}

/* ── 快捷键帮助 ── */
.shortcut-help {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--fs-body-sm);
  color: var(--color-text-secondary);
}

.shortcut-row:last-child {
  border-bottom: none;
}

.shortcut-row-keys {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}
```

- [ ] **Step 5: main.js 移除 useTheme 副作用 import**

用 Edit 将 `src/main.js` 中以下两行删除（保留其余不变）：

```js
// 副作用：在挂载前应用本地主题偏好（data-theme），避免闪色
import './composables/useTheme'
```

- [ ] **Step 6: 构建与测试验证**

Run: `pnpm build && pnpm test`
Expected: 全部通过（此时页面视觉为中间态属预期，不在本任务验收范围）。

- [ ] **Step 7: 提交**

```bash
git add src/styles src/main.js
git commit -m "refactor: 重写设计token与全局样式"
```

---

### Task 3: 登录「记住设备」（后端 + store + 测试）

**Files:**
- Modify: `functions/api/auth/login.js`
- Modify: `wrangler.toml`
- Modify: `src/stores/auth.js`
- Modify: `src/composables/useAuth.js`
- Test: `src/stores/auth.test.js`（整文件重写）

**Interfaces:**
- Consumes: 现有 `POST /api/auth/login` 调用方（Login.vue 于 Task 4 适配）。
- Produces:
  - `useAuth().login(username, password, remember)` → Promise
  - 后端响应新增字段 `remember: boolean`
  - 存储规则：remember=true → localStorage；false → sessionStorage

- [ ] **Step 1: 重写测试文件（先写失败测试）**

用 Write 整文件替换 `src/stores/auth.test.js` 为：

```js
// @vitest-environment happy-dom
// 认证状态 store 单测（含记住设备分流）
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('无 token 时未认证，init 不改变状态', () => {
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBe('')
  })

  it('localStorage 中过期 token 会被 init 清除', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', String(Date.now() - 1000))
    localStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('localStorage 中未过期的 token 恢复登录态', () => {
    localStorage.setItem('auth_token', 'abc')
    localStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    localStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(true)
    expect(store.username).toBe('admin')
  })

  it('sessionStorage 中未过期的 token 也能恢复登录态', () => {
    sessionStorage.setItem('auth_token', 'abc')
    sessionStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    sessionStorage.setItem('auth_username', 'admin')
    const store = useAuthStore()
    store.init()
    expect(store.isAuthenticated).toBe(true)
    expect(store.username).toBe('admin')
  })

  it('localStorage 优先于 sessionStorage', () => {
    localStorage.setItem('auth_token', 'local')
    localStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    sessionStorage.setItem('auth_token', 'session')
    sessionStorage.setItem('auth_expires_at', String(Date.now() + 86400_000))
    const store = useAuthStore()
    store.init()
    expect(store.token).toBe('local')
  })

  it('getAuthHeaders 注入 Basic 头', () => {
    const store = useAuthStore()
    expect(store.getAuthHeaders()).toEqual({})
    store.token = 'abc'
    expect(store.getAuthHeaders()).toEqual({ Authorization: 'Basic abc' })
  })

  it('clearAuth 清空状态与两处存储', () => {
    localStorage.setItem('auth_token', 'a')
    localStorage.setItem('auth_expires_at', '1')
    sessionStorage.setItem('auth_token', 'b')
    const store = useAuthStore()
    store.token = 'a'
    store.expiresAt = 1
    store.clearAuth()
    expect(store.token).toBe('')
    expect(store.expiresAt).toBe(0)
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('auth_expires_at')).toBeNull()
    expect(sessionStorage.getItem('auth_token')).toBeNull()
  })

  it('remember=true 登录写入 localStorage 且请求携带 remember', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'tok', expiresAt: Date.now() + 30 * 86400_000, durationDays: 30,
      remember: true, username: 'admin', success: true
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const store = useAuthStore()
    const r = await store.login('admin', 'pw', true)
    expect(r.success).toBe(true)
    expect(r.remember).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('auth_token')).toBe('tok')
    expect(sessionStorage.getItem('auth_token')).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).remember).toBe(true)
    vi.unstubAllGlobals()
  })

  it('remember=false 登录写入 sessionStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'tok', expiresAt: Date.now() + 7 * 86400_000, durationDays: 7,
      remember: false, username: 'admin', success: true
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const store = useAuthStore()
    const r = await store.login('admin', 'pw')
    expect(r.success).toBe(true)
    expect(r.remember).toBe(false)
    expect(sessionStorage.getItem('auth_token')).toBe('tok')
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).remember).toBe(false)
    vi.unstubAllGlobals()
  })

  it('登录失败抛出服务端错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: '用户名或密码错误' }), { status: 401 }
    )))
    const store = useAuthStore()
    await expect(store.login('admin', 'bad')).rejects.toThrow('用户名或密码错误')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/stores/auth.test.js`
Expected: FAIL（store.login 尚不接受 remember、未分流存储）。

- [ ] **Step 3: 重写 auth store**

用 Write 整文件替换 `src/stores/auth.js` 为：

```js
import { defineStore } from 'pinia'

const TOKEN_KEY = 'auth_token'
const USERNAME_KEY = 'auth_username'
const EXPIRES_KEY = 'auth_expires_at'

// 记住设备：勾选 → localStorage（30 天）；不勾选 → sessionStorage（关浏览器即失效）
function authStorage(remember) {
  return remember ? localStorage : sessionStorage
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    username: '',
    expiresAt: 0,
    isAuthenticated: false
  }),

  getters: {
    // 检查是否已过期
    isExpired: (state) => {
      if (!state.expiresAt) return true
      return Date.now() > state.expiresAt
    },

    // 剩余天数
    remainingDays: (state) => {
      if (!state.expiresAt) return 0
      const remaining = state.expiresAt - Date.now()
      return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
    }
  },

  actions: {
    // 初始化时检查登录状态（localStorage 优先，其次 sessionStorage）
    init() {
      if (this.restoreFrom(localStorage)) return
      if (this.restoreFrom(sessionStorage)) return
      this.clearAuth()
    },

    // 从指定存储恢复登录态；过期残留会被清理。成功返回 true
    restoreFrom(storage) {
      const token = storage.getItem(TOKEN_KEY)
      const expiresAt = parseInt(storage.getItem(EXPIRES_KEY) || '0')

      if (token && expiresAt && Date.now() < expiresAt) {
        this.token = token
        this.username = storage.getItem(USERNAME_KEY) || ''
        this.expiresAt = expiresAt
        this.isAuthenticated = true
        return true
      }

      if (token) {
        storage.removeItem(TOKEN_KEY)
        storage.removeItem(USERNAME_KEY)
        storage.removeItem(EXPIRES_KEY)
      }
      return false
    },

    // 登录；remember=true 时凭据持久化到 localStorage
    async login(username, password, remember = false) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, remember })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '登录失败')
        }

        const data = await response.json()
        const rememberMe = data.remember === true

        // 保存登录状态
        this.token = data.token
        this.username = data.username
        this.expiresAt = data.expiresAt
        this.isAuthenticated = true

        // 写入所选存储并清理另一处，避免两处残留不同凭据
        const target = authStorage(rememberMe)
        const other = target === localStorage ? sessionStorage : localStorage
        other.removeItem(TOKEN_KEY)
        other.removeItem(USERNAME_KEY)
        other.removeItem(EXPIRES_KEY)
        target.setItem(TOKEN_KEY, data.token)
        target.setItem(USERNAME_KEY, data.username)
        target.setItem(EXPIRES_KEY, String(data.expiresAt))

        return {
          success: true,
          durationDays: data.durationDays,
          remember: rememberMe
        }
      } catch (error) {
        console.error('Login error:', error)
        throw error
      }
    },

    // 登出
    logout() {
      this.clearAuth()
    },

    // 清除认证信息
    clearAuth() {
      this.token = ''
      this.username = ''
      this.expiresAt = 0
      this.isAuthenticated = false

      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem(TOKEN_KEY)
        storage.removeItem(USERNAME_KEY)
        storage.removeItem(EXPIRES_KEY)
      }
    },

    // 获取认证头
    getAuthHeaders() {
      return this.token ? { Authorization: `Basic ${this.token}` } : {}
    }
  }
})
```

- [ ] **Step 4: 更新 useAuth 透传 remember**

用 Edit 将 `src/composables/useAuth.js` 中：

```js
  const login = (username, password) => store.login(username, password)
```

替换为：

```js
  const login = (username, password, remember) => store.login(username, password, remember)
```

- [ ] **Step 5: 后端 login API 支持 remember**

用 Edit 将 `functions/api/auth/login.js` 中：

```js
    const { username, password } = await request.json();
```

替换为：

```js
    const { username, password, remember } = await request.json();
```

再用 Edit 将：

```js
      // 从环境变量读取登录保持天数，默认7天
      const durationDays = parseInt(env.LOGIN_DURATION_DAYS || '7', 10);
      const expiresIn = durationDays * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + expiresIn;

      return Response.json(
        {
          token,
          expiresAt,
          durationDays,
          username,
          success: true
        },
        { headers }
      );
```

替换为：

```js
      // 勾选记住设备 → REMEMBER_DURATION_DAYS（默认30天）；否则 LOGIN_DURATION_DAYS（默认7天）
      const rememberMe = remember === true;
      const durationDays = rememberMe
        ? parseInt(env.REMEMBER_DURATION_DAYS || '30', 10)
        : parseInt(env.LOGIN_DURATION_DAYS || '7', 10);
      const expiresIn = durationDays * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + expiresIn;

      return Response.json(
        {
          token,
          expiresAt,
          durationDays,
          remember: rememberMe,
          username,
          success: true
        },
        { headers }
      );
```

- [ ] **Step 6: wrangler.toml 新增环境变量**

用 Edit 在 `wrangler.toml` 的 `[vars]` 段中 `LOGIN_DURATION_DAYS = "7"` 之后新增一行：

```toml
REMEMBER_DURATION_DAYS = "30"
```

- [ ] **Step 7: 运行测试确认通过**

Run: `pnpm test src/stores/auth.test.js`
Expected: PASS（10 个用例全绿）。

- [ ] **Step 8: 全量回归**

Run: `pnpm test && pnpm build`
Expected: 全部通过。

- [ ] **Step 9: 提交**

```bash
git add functions/api/auth/login.js wrangler.toml src/stores/auth.js src/stores/auth.test.js src/composables/useAuth.js
git commit -m "feat: 登录支持记住设备"
```

---

### Task 4: 登录页重写

**Files:**
- Modify: `src/views/Login.vue`（整文件重写）

**Interfaces:**
- Consumes: Task 2 的 `.login-*` 类名；Task 3 的 `useAuth().login(username, password, remember)`；`useSettingsStore().displayName`（不 fetch，未配置时显示默认站点名）。
- Produces: 无新接口（路由 `/login` 不变）。

- [ ] **Step 1: 重写 Login.vue**

用 Write 整文件替换 `src/views/Login.vue` 为：

```vue
<template>
  <div class="login-page">
    <main class="login-card">
      <!-- 品牌头 -->
      <div class="login-brand">
        <div class="login-brand-icon">
          <i class="ri-flash-fill"></i>
        </div>
        <h1 class="login-brand-title">欢迎登录 {{ siteName }}</h1>
        <p class="login-brand-subtitle">同步你的书签资料库，打造极致纯净的起始页</p>
      </div>

      <!-- 登录表单 -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="login-field">
          <label class="login-label" for="login-username">用户名</label>
          <input
            id="login-username"
            v-model="form.username"
            type="text"
            class="login-input"
            placeholder="username"
            required
            autocomplete="username"
          />
        </div>

        <div class="login-field">
          <label class="login-label" for="login-password">密码</label>
          <div class="login-input-wrap">
            <input
              id="login-password"
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              class="login-input has-password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
            <button
              type="button"
              class="login-password-toggle"
              :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              @click="showPwd = !showPwd"
            >
              <i :class="showPwd ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
            </button>
          </div>
        </div>

        <label class="login-remember">
          <input v-model="remember" type="checkbox" />
          <span class="login-checkbox"><i class="ri-check-line"></i></span>
          <span class="login-remember-text">记住此设备（30天内免登录）</span>
        </label>

        <div v-if="error" class="login-error">{{ error }}</div>

        <button type="submit" class="login-submit" :disabled="loading">
          <template v-if="loading">
            <span class="login-spinner"></span>
            <span>正在登录...</span>
          </template>
          <template v-else-if="success">
            <i class="ri-check-line"></i>
            <span>登录成功</span>
          </template>
          <template v-else>
            <span>立即登录</span>
            <i class="ri-arrow-right-line"></i>
          </template>
        </button>
      </form>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const { login } = useAuth()
const settings = useSettingsStore()

const siteName = computed(() => settings.displayName)

const form = reactive({ username: '', password: '' })
const remember = ref(true)
const showPwd = ref(false)
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    await login(form.username, form.password, remember.value)
    success.value = true
    setTimeout(() => router.push('/'), 500)
  } catch (err) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 2: 构建与测试验证**

Run: `pnpm build && pnpm test`
Expected: 全部通过。

- [ ] **Step 3: 提交**

```bash
git add src/views/Login.vue
git commit -m "refactor: 重写登录页"
```

---

### Task 5: 顶栏重写 + 快捷键帮助弹窗

**Files:**
- Modify: `src/components/layout/AppHeader.vue`（整文件重写）
- Create: `src/components/common/ShortcutHelp.vue`

**Interfaces:**
- Consumes: Task 2 的 `.app-header*`、`.shortcut-*`、`.kbd` 类名；`useSettingsStore().displayName` / `.avatar`。
- Produces:
  - `AppHeader` props: `username: String`；emits: `open-settings`、`open-shortcuts`（**不再有 `add-bookmark`**，旧 Home.vue 的 `@add-bookmark` 监听将静默失效，Task 6 重写 Home.vue 时移除）。
  - `ShortcutHelp` emits: `close`。

- [ ] **Step 1: 重写 AppHeader.vue**

用 Write 整文件替换 `src/components/layout/AppHeader.vue` 为：

```vue
<template>
  <header class="app-header">
    <div class="app-header-inner">
      <a class="app-header-brand" href="#startpage-hero">
        <span class="app-header-logo">
          <i class="ri-flash-fill"></i>
        </span>
        <span class="app-header-name">{{ siteName }}</span>
      </a>

      <div class="app-header-actions">
        <button
          type="button"
          class="app-header-btn"
          @click="$emit('open-shortcuts')"
          aria-label="快捷键帮助"
          title="快捷键帮助"
        >
          <i class="ri-question-line"></i>
        </button>

        <button
          type="button"
          class="app-header-btn"
          @click="$emit('open-settings')"
          aria-label="设置"
          title="设置"
        >
          <i class="ri-settings-line"></i>
        </button>

        <!-- 头像仅作展示，退出登录在设置面板中 -->
        <div class="app-header-avatar" :title="username">
          <img v-if="avatar" :src="avatar" alt="头像" />
          <template v-else>{{ usernameInitial }}</template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps({
  username: {
    type: String,
    default: '管理员'
  }
})

defineEmits(['open-settings', 'open-shortcuts'])

const settings = useSettingsStore()
const siteName = computed(() => settings.displayName)
const avatar = computed(() => settings.avatar)
const usernameInitial = computed(() => (props.username || 'N').charAt(0).toUpperCase())
</script>
```

- [ ] **Step 2: 新建 ShortcutHelp.vue**

用 Write 创建 `src/components/common/ShortcutHelp.vue`：

```vue
<template>
  <Modal title="键盘快捷键" @close="$emit('close')">
    <div class="shortcut-help">
      <div class="shortcut-row">
        <span>聚焦搜索框</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Ctrl</span>
          <span class="kbd">K</span>
        </span>
      </div>
      <div class="shortcut-row">
        <span>添加书签</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Alt</span>
          <span class="kbd">N</span>
        </span>
      </div>
      <div class="shortcut-row">
        <span>添加分类</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Alt</span>
          <span class="kbd">Shift</span>
          <span class="kbd">N</span>
        </span>
      </div>
      <div class="shortcut-row">
        <span>关闭弹窗 / 菜单</span>
        <span class="shortcut-row-keys">
          <span class="kbd">Esc</span>
        </span>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import Modal from './Modal.vue'

defineEmits(['close'])
</script>
```

- [ ] **Step 3: 构建与测试验证**

Run: `pnpm build && pnpm test`
Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add src/components/layout/AppHeader.vue src/components/common/ShortcutHelp.vue
git commit -m "refactor: 重写顶栏并新增快捷键帮助"
```

---

### Task 6: 主页重写（内联首屏 + 删除旧 hero 组件）

**Files:**
- Modify: `src/views/Home.vue`（整文件重写）
- Delete: `src/components/hero/HeroClock.vue`
- Delete: `src/components/hero/HeroSearch.vue`
- Delete: `src/components/hero/HeroCategoryCards.vue`
- Delete: `src/components/common/SearchEngineTabs.vue`

**Interfaces:**
- Consumes: Task 2 全部首屏/页脚类名；Task 5 的 AppHeader（`open-shortcuts` emit）与 ShortcutHelp；现有 BookmarkExplorer（旧接口仍可用：不加 `filter-text` 即可）、useSearchEngines、useFavicon、useDateInfo、useLunar、useKeyboard、useContextMenu、useToast。
- Produces: 无新对外接口；Home.vue 不再 emit/使用 `filter-text`、`heroCategories`、`greeting`、`scrollToCategory`。

- [ ] **Step 1: 重写 Home.vue**

用 Write 整文件替换 `src/views/Home.vue` 为：

```vue
<template>
  <div class="app">
    <!-- 顶栏 -->
    <AppHeader
      :username="username"
      @open-settings="settingsModal.visible = true"
      @open-shortcuts="shortcutModal.visible = true"
    />

    <main class="app-main">
      <!-- 第一屏：时钟 + 搜索 + 常用站点 -->
      <section id="startpage-hero" class="hero">
        <div class="hero-content">
          <!-- 时钟 -->
          <div class="hero-clock">
            <span class="hero-clock-hm">{{ hhmm }}</span>
            <span class="hero-clock-sec">:{{ ss }}</span>
          </div>

          <!-- 日期行 -->
          <div class="hero-meta">
            <span class="hero-meta-date">{{ gregorianText }}</span>
            <span class="badge badge-primary">{{ weekdayText }}</span>
            <span class="hero-meta-dot">•</span>
            <span>{{ lunarText }}</span>
            <span class="hero-meta-dot">•</span>
            <span class="badge badge-mono">第 {{ weekOfYear }} 周</span>
          </div>

          <!-- 搜索 -->
          <form class="hero-search" @submit.prevent="onSearchSubmit">
            <div class="hero-search-box">
              <div class="hero-search-engine-wrap">
                <button
                  type="button"
                  class="hero-search-engine"
                  :aria-expanded="engineMenuOpen"
                  @click="toggleEngineMenu"
                >
                  <span class="hero-search-engine-dot"></span>
                  <span>{{ currentEngineLabel }}</span>
                  <i class="ri-arrow-down-s-line"></i>
                </button>
                <div
                  v-if="engineMenuOpen"
                  class="hero-search-engine-menu"
                  @mousedown.prevent
                >
                  <button
                    v-for="engine in engines"
                    :key="engine.id"
                    type="button"
                    class="hero-search-engine-item"
                    :class="{ active: engine.id === currentEngineId }"
                    @click="selectEngine(engine.id)"
                  >
                    {{ engine.label }}
                  </button>
                </div>
              </div>

              <div class="hero-search-field">
                <i class="ri-search-line"></i>
                <input
                  ref="searchInput"
                  v-model="query"
                  type="text"
                  class="hero-search-input"
                  placeholder="键入关键词或网页链接，按下 Enter 立即检索..."
                  autocomplete="off"
                  @input="onSearchInput"
                  @focus="onSearchFocus"
                  @blur="onSearchBlur"
                />
              </div>

              <div class="hero-search-kbd">
                <span class="kbd">Ctrl</span>
                <span class="kbd">K</span>
              </div>
            </div>

            <!-- 站内结果下拉 -->
            <div
              v-if="showDropdown && (internalResults.length > 0 || showEngineHint)"
              class="hero-search-results"
              @mousedown.prevent
            >
              <a
                v-for="bm in internalResults"
                :key="bm.id"
                :href="bm.url"
                target="_blank"
                rel="noopener noreferrer"
                class="hero-search-result"
                @click="onResultClick"
              >
                <span class="hero-search-result-favicon">
                  <img v-if="iconSrc(bm)" :src="iconSrc(bm)" :alt="bm.title" loading="lazy" @error="onIconError(bm)" />
                  <span v-else class="favicon-fallback">{{ iconInitial(bm) }}</span>
                </span>
                <span class="hero-search-result-info">
                  <span class="hero-search-result-title">{{ bm.title }}</span>
                  <span class="hero-search-result-url">{{ bm.url }}</span>
                </span>
              </a>

              <div v-if="internalResults.length > 0 && showEngineHint" class="hero-search-engine-hint">
                ↵ 用 {{ currentEngineLabel }} 搜索 "{{ query }}"
              </div>

              <div v-if="internalResults.length === 0 && showEngineHint" class="hero-search-empty">
                无站内匹配，按 ↵ 用 {{ currentEngineLabel }} 搜索 "{{ query }}"
              </div>
            </div>
          </form>

          <!-- 常用站点：排序前 5 -->
          <div v-if="favoriteBookmarks.length" class="hero-favorites">
            <a
              v-for="bm in favoriteBookmarks"
              :key="bm.id"
              class="hero-fav-card"
              :href="bm.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="hero-fav-icon">
                <img v-if="iconSrc(bm)" :src="iconSrc(bm)" :alt="bm.title" loading="lazy" @error="onIconError(bm)" />
                <span v-else class="favicon-fallback">{{ iconInitial(bm) }}</span>
              </span>
              <span class="hero-fav-name">{{ bm.title }}</span>
            </a>
          </div>
        </div>

        <!-- 滚动提示 -->
        <a class="hero-scroll-hint" href="#explorer-section">
          <span>向下滚动查看书签库</span>
          <i class="ri-arrow-down-line"></i>
        </a>
      </section>

      <!-- 第二屏：书签库 -->
      <BookmarkExplorer
        :bookmarks="bookmarks"
        :categories="explorerCategories"
        :active-cat="activeCategory"
        @add-bookmark="showBookmarkForm()"
        @add-category="showCategoryForm()"
        @select-category="selectCategory"
        @category-menu="showCategoryMenu"
        @menu="showBookmarkMenu"
      />

      <!-- 加载状态 -->
      <div v-if="bookmarksLoading && bookmarks.length === 0" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载书签中…</span>
      </div>
    </main>

    <!-- 底部信息栏 -->
    <footer class="app-footer">
      <div class="app-footer-inner">
        <div class="app-footer-meta">
          <span class="app-footer-site">{{ settingsStore.displayName }}</span>
          <span>·</span>
          <span>{{ categories.length }} 个分类 · {{ bookmarks.length }} 个书签</span>
        </div>
        <div class="app-footer-links">
          <button type="button" @click="settingsModal.visible = true">导入与导出</button>
          <button type="button" @click="shortcutModal.visible = true">键盘快捷键</button>
          <span class="app-footer-version">v{{ appVersion }}</span>
        </div>
      </div>
    </footer>

    <!-- 右键菜单 -->
    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="onMenuSelect"
      @close="hideContextMenu"
    />

    <!-- 分类表单弹窗 -->
    <Modal
      v-if="categoryModal.visible"
      :title="categoryModal.data ? '编辑分类' : '新建分类'"
      @close="categoryModal.visible = false"
    >
      <CategoryForm
        :category="categoryModal.data"
        :colors="presetColors"
        :icons="presetIcons"
        :loading="categoryModal.loading"
        @submit="handleCategorySubmit"
        @cancel="categoryModal.visible = false"
      />
    </Modal>

    <!-- 书签表单弹窗 -->
    <Modal
      v-if="bookmarkModal.visible"
      :title="bookmarkModal.data ? '编辑书签' : '新建书签'"
      @close="bookmarkModal.visible = false"
    >
      <BookmarkForm
        :bookmark="bookmarkModal.data"
        :categories="categories"
        :loading="bookmarkModal.loading"
        @submit="handleBookmarkSubmit"
        @cancel="bookmarkModal.visible = false"
      />
    </Modal>

    <!-- 设置面板 -->
    <SettingsPanel
      v-if="settingsModal.visible"
      @close="settingsModal.visible = false"
    />

    <!-- 快捷键帮助 -->
    <ShortcutHelp
      v-if="shortcutModal.visible"
      @close="shortcutModal.visible = false"
    />

    <!-- Toast -->
    <ToastMessage
      v-if="toast.visible"
      :message="toast.message"
      :type="toast.type"
      @close="hideToast"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

import AppHeader from '../components/layout/AppHeader.vue'
import BookmarkExplorer from '../components/bookmark/BookmarkExplorer.vue'
import BookmarkForm from '../components/bookmark/BookmarkForm.vue'
import CategoryForm from '../components/category/CategoryForm.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import Modal from '../components/common/Modal.vue'
import SettingsPanel from '../components/common/SettingsPanel.vue'
import ShortcutHelp from '../components/common/ShortcutHelp.vue'
import ToastMessage from '../components/common/ToastMessage.vue'

import { useBookmarks } from '../composables/useBookmarks'
import { useCategories } from '../composables/useCategories'
import { useAuth } from '../composables/useAuth'
import { useContextMenu } from '../composables/useContextMenu'
import { useKeyboard } from '../composables/useKeyboard'
import { useToast } from '../composables/useToast'
import { useSearchEngines } from '../composables/useSearchEngines'
import { useFavicon } from '../composables/useFavicon'
import { useDateInfo } from '../composables/useLunar'
import { useSettingsStore } from '../stores/settings'
import { CATEGORY_ICONS } from '../constants/categoryIcons'
import pkg from '../../package.json'

const settingsStore = useSettingsStore()
const appVersion = pkg.version

// ── 预设数据 ──
const presetColors = [
  { name: '翡翠', value: '#10b981' },
  { name: '靛蓝', value: '#4F46E5' },
  { name: '紫色', value: '#7C3AED' },
  { name: '粉色', value: '#DB2777' },
  { name: '红色', value: '#DC2626' },
  { name: '橙色', value: '#EA580C' },
  { name: '琥珀', value: '#F59E0B' },
  { name: '青色', value: '#0D9488' },
  { name: '蓝色', value: '#2563EB' },
  { name: '灰色', value: '#6B7280' }
]

const presetIcons = CATEGORY_ICONS

// ── 组合式函数 ──
const { bookmarks, loading: bookmarksLoading, fetchBookmarks, createBookmark, updateBookmark, deleteBookmark } = useBookmarks()
const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategories()
const { username } = useAuth()
const { contextMenu, showContextMenu, hideContextMenu, handleMenuSelect } = useContextMenu()
const { toast, showToast, hideToast, success, error: showError } = useToast()
const { engines, currentEngineId, setEngine, resolveAndOpen } = useSearchEngines()
const { iconSrc, onIconError, iconInitial } = useFavicon()
const { getLunarText, getWeekOfYear, getGregorianText, getWeekdayText } = useDateInfo()

// ── 本地状态 ──
const activeCategory = ref('all')

const categoryModal = ref({ visible: false, data: null, loading: false })
const bookmarkModal = ref({ visible: false, data: null, loading: false })
const settingsModal = ref({ visible: false })
const shortcutModal = ref({ visible: false })

// ── 时钟（每秒刷新；农历每分钟异步刷新） ──
const now = ref(new Date())
let clockTimer = null
let lunarTimer = null

const hhmm = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const ss = computed(() => String(now.value.getSeconds()).padStart(2, '0'))
const gregorianText = computed(() => getGregorianText(now.value))
const weekdayText = computed(() => getWeekdayText(now.value))
const weekOfYear = computed(() => getWeekOfYear(now.value))
// 农历依赖较大，动态加载后异步填充
const lunarText = ref('')

async function refreshLunar() {
  lunarText.value = await getLunarText(now.value)
}

// ── 搜索 ──
const searchInput = ref(null)
const query = ref('')
const hasFocus = ref(false)
const engineMenuOpen = ref(false)

const currentEngineLabel = computed(() => engines.find(e => e.id === currentEngineId.value)?.label || '')

// 站内匹配：标题 / URL
const internalResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return bookmarks.value
    .filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q)
    )
    .slice(0, 6)
})

const showDropdown = computed(() => query.value.trim() && hasFocus.value)
const showEngineHint = computed(() => query.value.trim().length > 0)

function onSearchInput() {
  hasFocus.value = true
}

function onSearchFocus() {
  hasFocus.value = true
}

function onSearchBlur() {
  // 延迟关闭，避免点击下拉时先失焦
  setTimeout(() => { hasFocus.value = false }, 150)
}

function toggleEngineMenu() {
  engineMenuOpen.value = !engineMenuOpen.value
}

function selectEngine(id) {
  setEngine(id)
  engineMenuOpen.value = false
  searchInput.value?.focus()
}

function closeEngineMenu() {
  engineMenuOpen.value = false
}

// 点击引擎菜单以外区域时关闭
function onDocumentClick(e) {
  if (engineMenuOpen.value && !e.target.closest('.hero-search-engine-wrap')) {
    closeEngineMenu()
  }
}

function onResultClick() {
  query.value = ''
  hasFocus.value = false
}

function onSearchSubmit() {
  const result = resolveAndOpen(query.value)
  if (!result) return
  // 回车一律按当前规则跳转：域名直达或当前引擎搜索
  window.open(result.target, '_blank', 'noopener,noreferrer')
  query.value = ''
  hasFocus.value = false
}

function focusSearch() {
  searchInput.value?.focus()
  searchInput.value?.select()
}

// ── 常用站点：按 sort_order 取前 5 ──
const favoriteBookmarks = computed(() =>
  [...bookmarks.value]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .slice(0, 5)
)

// ── 分类计数 ──
const categoryCountMap = computed(() => {
  const map = {}
  categories.value.forEach(c => { map[c.id] = 0 })
  bookmarks.value.forEach(b => {
    if (b.category_id && map[b.category_id] !== undefined) map[b.category_id]++
  })
  return map
})

const explorerCategories = computed(() => {
  return categories.value.map(c => ({
    id: c.id,
    name: c.name,
    count: categoryCountMap.value[c.id] || 0
  }))
})

// ── 分类选择（tabs 位于第二屏，无需滚动） ──
function selectCategory(id) {
  activeCategory.value = id
}

// ── 快捷键 ──
useKeyboard({
  search: focusSearch,
  addBookmark: () => showBookmarkForm(),
  addCategory: () => showCategoryForm(),
  close: () => {
    categoryModal.value.visible = false
    bookmarkModal.value.visible = false
    settingsModal.value.visible = false
    shortcutModal.value.visible = false
    closeEngineMenu()
    hideContextMenu()
  }
})

// ── 右键菜单 ──
function showBookmarkMenu(event, bookmark) {
  showContextMenu(event, [
    { icon: 'ri-edit-line', label: '编辑', action: 'edit-bookmark' },
    { icon: 'ri-file-copy-line', label: '复制链接', action: 'copy-link' },
    { divider: true },
    { icon: 'ri-delete-bin-line', label: '删除', action: 'delete-bookmark', danger: true }
  ], bookmark)
}

function showCategoryMenu(event, category) {
  showContextMenu(event, [
    { icon: 'ri-edit-line', label: '编辑分类', action: 'edit-category' },
    { divider: true },
    { icon: 'ri-delete-bin-line', label: '删除分类', action: 'delete-category', danger: true }
  ], category)
}

async function onMenuSelect(action) {
  const { action: menuAction, target } = handleMenuSelect(action)
  if (!target) return
  switch (menuAction) {
    case 'edit-bookmark':
      showBookmarkForm(target)
      break
    case 'copy-link':
      try {
        await navigator.clipboard.writeText(target.url)
        success('链接已复制')
      } catch {
        showError('复制失败')
      }
      break
    case 'delete-bookmark':
      if (confirm(`确定要删除「${target.title}」吗？`)) {
        try {
          await deleteBookmark(target.id)
          success('书签已删除')
        } catch (err) {
          showError('删除失败: ' + err.message)
        }
      }
      break
    case 'edit-category': {
      // explorer 传出的对象只含 id/name/count，编辑表单需要完整的分类数据
      const full = categories.value.find(c => c.id === target.id)
      if (full) showCategoryForm(full)
      break
    }
    case 'delete-category':
      if (confirm(`确定删除分类「${target.name}」吗？分类下的书签将变为未分类。`)) {
        try {
          await deleteCategory(target.id)
          if (activeCategory.value === target.id) activeCategory.value = 'all'
          success('分类已删除')
        } catch (err) {
          showError('删除失败: ' + err.message)
        }
      }
      break
  }
}

// ── 表单 ──
function showCategoryForm(data = null) { categoryModal.value = { visible: true, data, loading: false } }
function showBookmarkForm(data = null) { bookmarkModal.value = { visible: true, data, loading: false } }

async function handleCategorySubmit(formData) {
  categoryModal.value.loading = true
  try {
    if (categoryModal.value.data) {
      await updateCategory(categoryModal.value.data.id, formData)
      success('分类已更新')
    } else {
      await createCategory(formData)
      success('分类已创建')
    }
    categoryModal.value.visible = false
  } catch (err) {
    showError('操作失败: ' + err.message)
  } finally {
    categoryModal.value.loading = false
  }
}

async function handleBookmarkSubmit(formData) {
  bookmarkModal.value.loading = true
  try {
    if (bookmarkModal.value.data) {
      await updateBookmark(bookmarkModal.value.data.id, formData)
      success('书签已更新')
    } else {
      await createBookmark(formData)
      success('书签已创建')
    }
    bookmarkModal.value.visible = false
  } catch (err) {
    showError('操作失败: ' + err.message)
  } finally {
    bookmarkModal.value.loading = false
  }
}

// ── 生命周期 ──
onMounted(async () => {
  refreshLunar()
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  // 农历一天才变一次，每分钟刷新足够
  lunarTimer = setInterval(refreshLunar, 60000)
  document.addEventListener('click', onDocumentClick)
  await Promise.all([fetchBookmarks(), fetchCategories(), settingsStore.fetchSettings()])
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (lunarTimer) clearInterval(lunarTimer)
  document.removeEventListener('click', onDocumentClick)
})
</script>
```

- [ ] **Step 2: 删除旧 hero 组件与 SearchEngineTabs**

Run:

```bash
rm src/components/hero/HeroClock.vue src/components/hero/HeroSearch.vue src/components/hero/HeroCategoryCards.vue
rmdir src/components/hero
rm src/components/common/SearchEngineTabs.vue
```

- [ ] **Step 3: 构建与测试验证**

Run: `pnpm build && pnpm test`
Expected: 全部通过。此时首屏与页脚已按新设计渲染。

- [ ] **Step 4: 提交**

```bash
git add src/views/Home.vue src/components
git commit -m "refactor: 重写主页首屏与页脚"
```

---

### Task 7: 书签库区块重写

**Files:**
- Modify: `src/components/bookmark/BookmarkExplorer.vue`（整文件重写）
- Modify: `src/components/bookmark/BookmarkCard.vue`（模板重写，script 不变）

**Interfaces:**
- Consumes: Task 2 的 `.explorer*`、`.category-tab*`、`.bookmark-*` 类名。
- Produces:
  - `BookmarkExplorer` props: `bookmarks`、`categories`、`activeCat`；emits: `add-bookmark`、`add-category`、`select-category`、`category-menu`、`menu`。**移除 `filter-text` prop 与 `update:filter-text` emit**（Task 6 的 Home.vue 已不再传递）。
  - `BookmarkCard` props/emits 不变。

- [ ] **Step 1: 重写 BookmarkExplorer.vue**

用 Write 整文件替换 `src/components/bookmark/BookmarkExplorer.vue` 为：

```vue
<template>
  <section id="explorer-section" class="explorer">
    <!-- 工具栏：分类 tabs + 添加 -->
    <div class="explorer-toolbar">
      <div class="category-tabs">
        <button
          type="button"
          class="category-tab"
          :class="{ active: activeCat === 'all' }"
          @click="$emit('select-category', 'all')"
        >
          <span>全部</span>
          <span class="category-tab-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="category-tab"
          :class="{ active: activeCat === cat.id }"
          @click="$emit('select-category', cat.id)"
          @contextmenu.prevent="$emit('category-menu', $event, cat)"
        >
          <span>{{ cat.name }}</span>
          <span class="category-tab-count">{{ cat.count }}</span>
        </button>
        <button
          type="button"
          class="category-tab-add"
          @click="$emit('add-category')"
          aria-label="新建分类"
          title="新建分类"
        >
          <i class="ri-add-line"></i>
        </button>
      </div>

      <button class="explorer-add-btn" type="button" @click="$emit('add-bookmark')">
        <i class="ri-add-line"></i>
        <span>添加网址</span>
      </button>
    </div>

    <!-- 网格 -->
    <div class="bookmark-grid">
      <template v-if="visibleBookmarks.length > 0">
        <BookmarkCard
          v-for="bm in visibleBookmarks"
          :key="bm.id"
          :bookmark="bm"
          @menu="$emit('menu', $event, bm)"
        />
      </template>
      <div v-else class="bookmark-empty">
        <i class="ri-bookmark-line"></i>
        <div>{{ emptyText }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import BookmarkCard from './BookmarkCard.vue'

const props = defineProps({
  bookmarks: {
    type: Array,
    required: true
  },
  categories: {
    type: Array,
    required: true
  },
  activeCat: {
    type: [String, Number],
    default: 'all'
  }
})

defineEmits(['add-bookmark', 'add-category', 'select-category', 'category-menu', 'menu'])

const totalCount = computed(() => props.bookmarks.length)

const visibleBookmarks = computed(() => {
  if (props.activeCat === 'all') return props.bookmarks
  return props.bookmarks.filter(b => b.category_id === props.activeCat)
})

const emptyText = computed(() => {
  if (props.activeCat !== 'all') return '该分类下暂无书签'
  return '暂无书签，点击右上角「添加网址」添加'
})
</script>
```

- [ ] **Step 2: 重写 BookmarkCard.vue**

用 Write 整文件替换 `src/components/bookmark/BookmarkCard.vue` 为（script 保持原逻辑不变，仅模板类名换新）：

```vue
<template>
  <a
    class="bookmark-card"
    :href="bookmark.url"
    target="_blank"
    rel="noopener noreferrer"
    @contextmenu.prevent="$emit('menu', $event)"
  >
    <span class="bookmark-card-favicon">
      <img v-if="iconSrc(bookmark)" :src="iconSrc(bookmark)" :alt="bookmark.title" loading="lazy" @error="onIconError(bookmark)" />
      <span v-else class="favicon-fallback">{{ iconInitial(bookmark) }}</span>
    </span>
    <span class="bookmark-card-info">
      <span class="bookmark-card-title">{{ bookmark.title }}</span>
      <span class="bookmark-card-domain">{{ domain }}</span>
    </span>
    <span class="bookmark-card-arrow">
      <i class="ri-external-link-line"></i>
    </span>
  </a>
</template>

<script setup>
import { computed } from 'vue'

import { useFavicon } from '../../composables/useFavicon'

const props = defineProps({
  bookmark: {
    type: Object,
    required: true
  }
})

defineEmits(['menu'])

const { iconSrc, onIconError, iconInitial } = useFavicon()

const domain = computed(() => {
  try {
    return new URL(props.bookmark.url).hostname.replace(/^www\./, '')
  } catch {
    return props.bookmark.url
  }
})
</script>
```

- [ ] **Step 3: 构建与测试验证**

Run: `pnpm build && pnpm test`
Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add src/components/bookmark/BookmarkExplorer.vue src/components/bookmark/BookmarkCard.vue
git commit -m "refactor: 重写书签库区块"
```

---

### Task 8: 设置面板与表单收尾（删除 useTheme）

**Files:**
- Modify: `src/components/common/SettingsPanel.vue`（删除「外观」区与 useTheme 引用）
- Modify: `src/components/bookmark/BookmarkForm.vue`（图标预览 inline style → class）
- Modify: `src/components/category/CategoryForm.vue`（footer inline style 清理）
- Delete: `src/composables/useTheme.js`

**Interfaces:**
- Consumes: Task 2 的 `.settings-*`、`.form-icon-preview*` 类名。
- Produces: SettingsPanel emits `close` 不变；删除后全项目无 `useTheme` 引用。

- [ ] **Step 1: 核对通用组件类名兼容（只读验证）**

Run:

```bash
grep -rn "useTheme" src/ --include="*.vue" --include="*.js"
```

Expected: 仅 `src/components/common/SettingsPanel.vue`、`src/composables/useTheme.js` 两处（main.js 已在 Task 2 移除）。若出现其他引用，先在本任务一并处理（改为删除对应引用）。

- [ ] **Step 2: SettingsPanel 删除「外观」区**

用 Edit 将 `src/components/common/SettingsPanel.vue` 中整段：

```vue
      <!-- 外观 -->
      <section class="settings-section">
        <span class="form-label">外观</span>
        <div class="settings-theme-toggle" role="group" aria-label="深色浅色模式切换">
          <button
            type="button"
            :class="['settings-theme-option', { active: theme === 'light' }]"
            @click="setTheme('light')"
          >
            <i class="ri-sun-line"></i>
            <span>浅色</span>
          </button>
          <button
            type="button"
            :class="['settings-theme-option', { active: theme === 'dark' }]"
            @click="setTheme('dark')"
          >
            <i class="ri-moon-line"></i>
            <span>深色</span>
          </button>
        </div>
        <p class="form-hint">主题偏好保存在本设备浏览器中。</p>
      </section>

```

删除（连同其后的空行）。

再用 Edit 删除 import 行：

```js
import { useTheme } from '../../composables/useTheme'
```

再用 Edit 删除：

```js
// ── 外观 ──
const { theme, setTheme } = useTheme()

```

- [ ] **Step 3: BookmarkForm 图标预览改类名**

用 Edit 将 `src/components/bookmark/BookmarkForm.vue` 中：

```vue
      <div class="form-hint" style="display:flex;align-items:center;gap:var(--space-sm);">
        <img
          :src="iconPreview"
          :alt="form.title"
          style="width:32px;height:32px;border-radius:var(--radius-sm);object-fit:contain;background:var(--color-surface-container-highest);padding:4px;"
          @error="iconPreviewFailed = true"
        />
        <span>保存后自动加载网站图标</span>
      </div>
```

替换为：

```vue
      <div class="form-hint form-icon-preview-row">
        <img
          :src="iconPreview"
          :alt="form.title"
          class="form-icon-preview"
          @error="iconPreviewFailed = true"
        />
        <span>保存后自动加载网站图标</span>
      </div>
```

再用 Edit 将：

```vue
    <div class="modal-footer" style="padding-left:0;padding-right:0;">
```

替换为：

```vue
    <div class="modal-footer">
```

- [ ] **Step 4: CategoryForm 清理 footer inline style**

用 Edit 将 `src/components/category/CategoryForm.vue` 中：

```vue
    <div class="modal-footer" style="padding-left:0;padding-right:0;">
```

替换为：

```vue
    <div class="modal-footer">
```

- [ ] **Step 5: 删除 useTheme.js**

Run:

```bash
rm src/composables/useTheme.js
```

- [ ] **Step 6: 确认无残留引用后构建测试**

Run:

```bash
grep -rn "useTheme\|nav-theme\|data-theme" src/ --include="*.vue" --include="*.js" || echo "无残留"
pnpm build && pnpm test
```

Expected: 「无残留」+ 全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/components/common/SettingsPanel.vue src/components/bookmark/BookmarkForm.vue src/components/category/CategoryForm.vue src/composables/useTheme.js
git commit -m "refactor: 移除深色主题与外观切换"
```

---

### Task 9: 文档更新与全量验收

**Files:**
- Modify: `CLAUDE.md`（架构树、核心设计相关条目）
- Modify: `README.md`（深浅色主题条目）

**Interfaces:**
- Consumes: 全部前置任务。
- Produces: 文档与代码一致；最终验收通过。

- [ ] **Step 1: 更新 CLAUDE.md 架构树**

用 Edit 将 `CLAUDE.md` 架构树中：

```
│   ├── layout/         # 布局组件（AppHeader）
│   ├── bookmark/       # 书签相关组件（BookmarkExplorer, BookmarkCard, BookmarkForm）
│   ├── category/       # 分类相关组件（CategoryForm）
│   ├── hero/           # 首屏组件（HeroClock, HeroSearch, HeroCategoryCards）
│   └── common/         # 通用组件（ContextMenu, Modal, SettingsPanel, ColorPicker, IconPicker…）
```

替换为：

```
│   ├── layout/         # 布局组件（AppHeader）
│   ├── bookmark/       # 书签相关组件（BookmarkExplorer, BookmarkCard, BookmarkForm）
│   ├── category/       # 分类相关组件（CategoryForm）
│   └── common/         # 通用组件（ContextMenu, Modal, SettingsPanel, ShortcutHelp, ColorPicker, IconPicker…）
```

再在架构树下方新增一行说明：

```
（首屏的时钟/搜索/常用站点已内联进 views/Home.vue）
```

- [ ] **Step 2: 更新 CLAUDE.md 核心设计条目**

用 Edit 将：

```
- **单页面应用**: 主页面 Home.vue 同时具备浏览和管理功能，第一屏占满视口高度、第二屏最小视口高度
```

替换为：

```
- **单页面应用**: 主页面 Home.vue 同时具备浏览和管理功能，第一屏（大字时钟 + 日期/农历/周数、搜索框含引擎下拉与 Ctrl+K 键帽、排序前 5 书签的常用站点快捷卡片、滚动提示）占满视口高度、第二屏书签库最小视口高度
```

用 Edit 将：

```
- **右键菜单操作**: 分类（分类 pill 与第一屏分类卡片）和书签（书签卡片）的编辑、删除等操作通过右键菜单触发
```

替换为：

```
- **右键菜单操作**: 分类（分类 pill）和书签（书签卡片）的编辑、删除等操作通过右键菜单触发
```

用 Edit 将：

```
- **设置面板**: 顶栏齿轮打开，集中网站名称、头像（前端压缩 128×128）、深浅色切换入口、导入导出、退出登录
```

替换为：

```
- **设置面板**: 顶栏齿轮打开，集中网站名称、头像（前端压缩 128×128）、导入导出、退出登录
```

用 Edit 将：

```
- **深浅色主题**: CSS 变量双主题——`:root` 深色为默认，`:root[data-theme='light']` 整块覆盖为浅色（含 `color-scheme`）；`useTheme` 组合式函数管理，存 localStorage `nav-theme`（纯本地偏好，不进服务端 settings），main.js 挂载前应用防闪色。组件样式禁止硬编码颜色：表面色的透明变体用 `rgba(var(--rgb-*), α)` 三元组组合，新增颜色必须同时补两套主题的 token
```

替换为：

```
- **主题**: 仅浅色主题（Tabular Minimalist：Slate 中性色 + 皇家蓝 `#2563EB`，扁平无阴影、紧凑圆角），无深色模式；设计参考 stitch_1。组件样式禁止硬编码颜色，一律引用 `src/styles/variables.css` 的 token
```

用 Edit 将：

```
- **字体/图标本地化**: 正文字体子集本地化于 `src/assets/fonts/`（`scripts/generate-fonts.mjs` 生成）；图标使用 remixicon npm 包（Apache 2.0），全量字体经 Vite 本地打包，无外部 CDN。新增图标直接写 `ri-xxx-line` class（对照 https://remixicon.com/），无需重跑脚本
```

替换为：

```
- **字体/图标本地化**: 正文字体（Inter + JetBrains Mono）子集本地化于 `src/assets/fonts/`（`scripts/generate-fonts.mjs` 生成）；图标使用 remixicon npm 包（Apache 2.0），全量字体经 Vite 本地打包，无外部 CDN。新增图标直接写 `ri-xxx-line` class（对照 https://remixicon.com/），无需重跑脚本
```

用 Edit 在「**Basic Auth 认证**」条目中：

```
- **Basic Auth 认证**: 密码存于 `.dev.vars`（本地）与 Pages Secret（线上），未配置时服务端拒绝一切访问；token 为 Basic 凭据 Base64 存 localStorage（含过期时间，默认 7 天）
```

替换为：

```
- **Basic Auth 认证**: 密码存于 `.dev.vars`（本地）与 Pages Secret（线上），未配置时服务端拒绝一切访问；token 为 Basic 凭据 Base64 存储（含过期时间）——登录页勾选「记住此设备」存 localStorage（30 天，`REMEMBER_DURATION_DAYS`），不勾选存 sessionStorage（关浏览器失效，后端按 `LOGIN_DURATION_DAYS` 默认 7 天兜底）
```

- [ ] **Step 3: 更新 README**

Run: `grep -n "深色\|主题\|hero\|首屏" README.md`

对每一处匹配行按新设计更新。已知第 12 行为：

```
- 🎨 **深浅色主题** - 设置面板一键切换，偏好保存在本机
```

用 Edit 替换为：

```
- 🎨 **扁平浅色设计** - Slate 中性色 + 皇家蓝点缀，无深色模式
```

若 grep 发现其他相关行（如功能清单中的首屏描述），按同样的口径改为新设计描述，并在提交信息中说明。

- [ ] **Step 4: 全量验收**

Run:

```bash
pnpm test
pnpm build
```

Expected: 测试全绿、构建成功。

- [ ] **Step 5: 视觉核对清单（pnpm dev:full + 浏览器）**

启动 `pnpm dev:full`，逐项核对（对照 stitch_1 参考稿）：

1. 登录页：440px 白卡、蓝色闪电 logo、标题/副标题、灰底输入框聚焦蓝环、眼睛切换、记住设备勾选框（默认勾选）、按钮三态（登录中 spinner / 登录成功勾）、错误红字；勾选登录后 localStorage 有 token，取消勾选登录后 sessionStorage 有 token。
2. 主页顶栏：sticky 白底 56px、蓝色 logo + 站点名、? / 齿轮 / 圆形头像；? 打开快捷键弹窗。
3. 首屏：点阵背景、mono 大字时钟 + 浅色秒、日期行（日期/星期蓝徽章/农历/周数灰徽章）、搜索框（引擎下拉可用、输入聚焦蓝环、⌘ 区域显示 Ctrl K、站内结果下拉、回车跳转）、5 张常用站点卡（不足 5 个书签时按实际数量显示）、底部滚动提示弹跳。
4. 第二屏：分类 tabs（激活深底白字 + 计数徽章）、+ 新建分类、添加网址蓝按钮、4 列书签卡（灰底、hover 白底蓝边微上浮、favicon、标题、mono 域名、外链箭头）、右键菜单可用、空分类空状态。
5. 弹窗/Toast/右键菜单：白卡蓝描边风格、遮罩无模糊、Toast 顶中带色点。
6. 页脚：站点名 · N 分类 · N 书签、导入与导出（打开设置面板）、键盘快捷键、版本号 v1.0.0。
7. 快捷键：Ctrl+K 聚焦搜索、Alt+N、Alt+Shift+N、Escape 全部可用。

如有与参考稿不一致处，按参考稿修正后重新 `pnpm build`。

- [ ] **Step 6: 提交**

```bash
git add CLAUDE.md README.md
git commit -m "docs: 更新重设计后的项目文档"
```

---

## 自审记录

- Spec 覆盖：spec 第 2 节（设计语言）→ Task 2；第 3.1（登录页）→ Task 4；第 3.2（顶栏/首屏/第二屏/页脚）→ Task 5/6/7；第 3.3（弹窗与通用组件）→ Task 2 CSS + Task 8 核对；第 4 节（文件变更）→ 各任务 Files；第 5 节（测试）→ Task 3 + 各任务 pnpm test；第 6 节（风险：字体重网络依赖→Task 1 停止上报；Home.vue 体积→分区注释已落实）。
- 类型一致性：`login(username, password, remember)`、`remember: boolean`、类名清单在 Task 2 定义且 Task 4-8 模板逐一引用同名，已核对。
- 占位符扫描：无 TBD/TODO；所有代码步骤含完整代码。
