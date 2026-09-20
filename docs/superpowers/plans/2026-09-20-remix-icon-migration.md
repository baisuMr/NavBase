# Remix Icon 图标迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 NavManager 的 UI 图标（Material Symbols）与分类图标（emoji）整体替换为 Remix Icon（npm 包全量字体，方案 A）。

**Architecture:** 引入 `remixicon` npm 包的 CSS（Vite 自动本地化 woff2，无 CDN），所有图标元素改为 `<i class="ri-xxx-line">` 单 class 写法；分类 `icon` 字段从 emoji 改存 `ri-*` 名，删除 `symbolMap` 映射层，存量数据用幂等 SQL 迁移；`generate-fonts.mjs` 瘦身为只处理正文字体，Material 字体与工具类清退。

**Tech Stack:** Vue 3 + JavaScript（无 TS）、纯 CSS、Vite、Cloudflare D1（wrangler）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-20-remix-icon-migration-design.md`

## Global Constraints

- 所有命令在 `nav-manager/` 目录下执行。
- 图标元素统一写法：`<i class="ri-xxx-line"></i>`，**元素上不与其他 class 并用**（CSS 附加样式依赖 `[class^="ri-"]` 前缀选择器）。
- 图标风格统一 line 变体（`ri-xxx-line`）；登录页品牌图标是唯一例外，用 `ri-bookmark-3-fill`。
- remixicon 依赖版本：`^4.9.1`（图标名已对照 4.9.1 的 remixicon.css 全部核实存在）。
- 深浅两主题都要手动验证；CSS 禁止硬编码颜色。
- Git 提交信息：中文，`类型: 描述`，动词开头 ≤50 字。
- 替换模板图标时保留元素上已有的 `style="font-size:var(--icon-size-*);"` 内联样式。
- `functions/utils/validate.js` 的 icon 校验**保持不变**（optional string 宽松校验）。

---

### Task 1: 安装 remixicon 并接入入口

**Files:**
- Modify: `package.json`（经 pnpm 自动）
- Modify: `src/main.js`

**Interfaces:**
- Produces: `remixicon/fonts/remixicon.css` 全局生效，任何元素可用 `<i class="ri-xxx-line">` 渲染图标。Material Symbols 在本任务后仍正常工作（fonts.css 未动），两套并存互不干扰。

- [ ] **Step 1: 安装依赖**

```bash
pnpm add remixicon
```

预期：package.json dependencies 出现 `"remixicon": "^4.9.1"`。

- [ ] **Step 2: 入口引入 CSS**

`src/main.js` 第 5 行 `import './styles/fonts.css'` 之前插入一行：

```js
// Remix Icon 图标字体（woff2 由 Vite 自动本地化打包）
import 'remixicon/fonts/remixicon.css'
```

- [ ] **Step 3: 验证构建产物包含本地字体**

```bash
pnpm build
```

预期：构建成功；`dist/assets/` 下出现 remixicon 的 woff2 产物（文件名含 hash）。

- [ ] **Step 4: 验证双字体并存**

```bash
pnpm dev:full
```

打开 http://localhost:5173 登录后，页面现有 Material 图标仍正常显示（未受影响）。在 DevTools 控制台执行 `document.body.insertAdjacentHTML('beforeend','<i class="ri-home-line" style="font-size:32px"></i>')` 应渲染出一个房子图标。

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/main.js
git commit -m "feat: 引入remixicon图标库"
```

---

### Task 2: 静态 UI 图标替换（Material → Remix）

**Files:**
- Modify: `src/views/Login.vue`
- Modify: `src/views/Home.vue`（仅模板静态图标 + 右键菜单 icon 值）
- Modify: `src/components/layout/AppHeader.vue`
- Modify: `src/components/hero/HeroSearch.vue`
- Modify: `src/components/bookmark/BookmarkCard.vue`
- Modify: `src/components/bookmark/BookmarkExplorer.vue`
- Modify: `src/components/common/Modal.vue`
- Modify: `src/components/common/ContextMenu.vue`
- Modify: `src/components/common/SettingsPanel.vue`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: Task 1 的 remixicon.css。
- Produces: ContextMenu 的 `item.icon` 值域变为 `ri-*` 名（本任务同步改调用方，`ContextMenu.vue` 模板用 `:class` 绑定）；CSS 附加样式选择器统一为 `[class^="ri-"]`。分类链路（HeroCategoryCards、iconForCategory、EmojiPicker）**不在本任务**，留给 Task 3。

统一替换模式：`<span class="material-symbols-outlined">名</span>` → `<i class="ri-名-line"></i>`（内联 style 原样保留）。

- [ ] **Step 1: 替换 Login.vue（6 处）**

| 行 | 原 | 新 |
|---|---|---|
| 8 | `<span class="material-symbols-outlined">bookmarks</span>` | `<i class="ri-bookmark-3-fill"></i>` |
| 19 | `>alternate_email<` | `<i class="ri-at-line"></i>` |
| 37 | `>lock<` | `<i class="ri-lock-line"></i>` |
| 54-56 | `<span class="material-symbols-outlined">{{ showPwd ? 'visibility_off' : 'visibility' }}</span>` | `<i :class="showPwd ? 'ri-eye-off-line' : 'ri-eye-line'"></i>` |
| 73 | `>check_circle<`（保留 style） | `<i class="ri-checkbox-circle-line" style="font-size:var(--icon-size-md);"></i>` |
| 78 | `>arrow_forward<`（保留 style） | `<i class="ri-arrow-right-line" style="font-size:var(--icon-size-md);"></i>` |

注：第 8 行品牌图标原本经 CSS `FILL 1` 显示实心，改用 `ri-bookmark-3-fill` 图标名承载实心效果。

- [ ] **Step 2: 替换 AppHeader.vue（4 处）**

| 行 | 原 | 新 |
|---|---|---|
| 7 | `>bookmark_heart<` | `<i class="ri-bookmark-3-line"></i>` |
| 26 | `>settings<`（保留 style） | `<i class="ri-settings-line" style="font-size:var(--icon-size-lg);"></i>` |
| 36 | `>add<`（保留 style） | `<i class="ri-add-line" style="font-size:var(--icon-size-lg);"></i>` |
| 42 | `>person<` | `<i class="ri-user-line"></i>` |

- [ ] **Step 3: 替换 HeroSearch.vue（2 处）**

| 行 | 原 | 新 |
|---|---|---|
| 14 | `>search<` | `<i class="ri-search-line"></i>` |
| 34 | `>close<` | `<i class="ri-close-line"></i>` |

- [ ] **Step 4: 替换 BookmarkCard.vue（1 处）**

| 行 | 原 | 新 |
|---|---|---|
| 18 | `>arrow_outward<` | `<i class="ri-external-link-line"></i>` |

- [ ] **Step 5: 替换 BookmarkExplorer.vue（5 处）**

| 行 | 原 | 新 |
|---|---|---|
| 7 | `>bookmarks<` | `<i class="ri-bookmark-line"></i>` |
| 23 | `>filter_alt<` | `<i class="ri-filter-3-line"></i>` |
| 34 | `>add<` | `<i class="ri-add-line"></i>` |
| 70 | `>add<` | `<i class="ri-add-line"></i>` |
| 85 | `>bookmarks<` | `<i class="ri-bookmark-line"></i>` |

- [ ] **Step 6: 替换 Modal.vue（1 处）**

| 行 | 原 | 新 |
|---|---|---|
| 7 | `>close<` | `<i class="ri-close-line"></i>` |

- [ ] **Step 7: 替换 ContextMenu.vue（1 处）**

第 16 行：

```vue
<!-- 原 -->
<span v-if="item.icon" class="material-symbols-outlined">{{ item.icon }}</span>
<!-- 新 -->
<i v-if="item.icon" :class="item.icon"></i>
```

- [ ] **Step 8: 替换 SettingsPanel.vue（7 处）**

| 行 | 原 | 新 |
|---|---|---|
| 33 | `>person<` | `<i class="ri-user-line"></i>` |
| 37 | `>add_a_photo<`（保留 style） | `<i class="ri-image-add-line" style="font-size:var(--icon-size-md);"></i>` |
| 70 | `>light_mode<` | `<i class="ri-sun-line"></i>` |
| 78 | `>dark_mode<` | `<i class="ri-moon-line"></i>` |
| 90 | `>upload<`（保留 style） | `<i class="ri-upload-line" style="font-size:var(--icon-size-md);"></i>` |
| 94 | `>download<`（保留 style） | `<i class="ri-download-line" style="font-size:var(--icon-size-md);"></i>` |
| 118 | `>logout<`（保留 style） | `<i class="ri-logout-box-r-line" style="font-size:var(--icon-size-md);"></i>` |

- [ ] **Step 9: 替换 Home.vue 模板静态图标（3 处）与右键菜单 icon 值（3 处）**

模板：

| 行 | 原 | 新 |
|---|---|---|
| 24 | `>bookmarks<` | `<i class="ri-bookmark-line"></i>` |
| 29 | `>folder<` | `<i class="ri-folder-line"></i>` |
| 53 | `>keyboard_double_arrow_down<` | `<i class="ri-arrow-down-double-line"></i>` |

`showBookmarkMenu`（约 332-335 行）与 `showCategoryMenu`（约 341-343 行）中的 icon 值：

```js
// 原
{ icon: 'edit', label: '编辑', action: 'edit-bookmark' },
{ icon: 'content_copy', label: '复制链接', action: 'copy-link' },
{ icon: 'delete', label: '删除', action: 'delete-bookmark', danger: true }
// 新
{ icon: 'ri-edit-line', label: '编辑', action: 'edit-bookmark' },
{ icon: 'ri-file-copy-line', label: '复制链接', action: 'copy-link' },
{ icon: 'ri-delete-bin-line', label: '删除', action: 'delete-bookmark', danger: true }

// 原
{ icon: 'edit', label: '编辑分类', action: 'edit-category' },
{ icon: 'delete', label: '删除分类', action: 'delete-category', danger: true }
// 新
{ icon: 'ri-edit-line', label: '编辑分类', action: 'edit-category' },
{ icon: 'ri-delete-bin-line', label: '删除分类', action: 'delete-category', danger: true }
```

- [ ] **Step 10: 替换 layout.css 选择器（19 处）与删除 FILL 声明**

把下列每个选择器中的 `.material-symbols-outlined` 改为 `[class^="ri-"]`（仅改选择器文本，声明块不动）：

```
.app-header-brand .material-symbols-outlined            → .app-header-brand [class^="ri-"]
.app-header-brand:hover .material-symbols-outlined      → .app-header-brand:hover [class^="ri-"]
.app-header-avatar .material-symbols-outlined           → .app-header-avatar [class^="ri-"]
.login-brand-icon .material-symbols-outlined            → .login-brand-icon [class^="ri-"]
.login-input-icon .material-symbols-outlined            → .login-input-icon [class^="ri-"]
.login-input-toggle .material-symbols-outlined          → .login-input-toggle [class^="ri-"]
.hero-stats-item .material-symbols-outlined             → .hero-stats-item [class^="ri-"]
.hero-stats-item.primary .material-symbols-outlined     → .hero-stats-item.primary [class^="ri-"]
.hero-stats-item.tertiary .material-symbols-outlined    → .hero-stats-item.tertiary [class^="ri-"]
.hero-search-input-wrap .search-icon .material-symbols-outlined → .hero-search-input-wrap .search-icon [class^="ri-"]
.hero-search-clear .material-symbols-outlined           → .hero-search-clear [class^="ri-"]
.hero-category-icon .material-symbols-outlined          → .hero-category-icon [class^="ri-"]
.hero-scroll-hint .material-symbols-outlined            → .hero-scroll-hint [class^="ri-"]
.explorer-header-icon .material-symbols-outlined        → .explorer-header-icon [class^="ri-"]
.explorer-filter .material-symbols-outlined             → .explorer-filter [class^="ri-"]
.explorer-add-btn .material-symbols-outlined            → .explorer-add-btn [class^="ri-"]
.category-pill-add .material-symbols-outlined           → .category-pill-add [class^="ri-"]
.bookmark-card-arrow .material-symbols-outlined         → .bookmark-card-arrow [class^="ri-"]
.bookmark-empty .material-symbols-outlined              → .bookmark-empty [class^="ri-"]
```

`.login-brand-icon [class^="ri-"]` 声明块（约 299-304 行）删除 `font-variation-settings: 'FILL' 1;` 一行（实心已由 `ri-bookmark-3-fill` 图标名承载）。

- [ ] **Step 11: 替换 components.css 选择器（5 处）**

```
.modal-close .material-symbols-outlined          → .modal-close [class^="ri-"]
.context-menu-item .material-symbols-outlined    → .context-menu-item [class^="ri-"]
.context-menu-item.danger .material-symbols-outlined → .context-menu-item.danger [class^="ri-"]
.settings-avatar-preview .material-symbols-outlined → .settings-avatar-preview [class^="ri-"]
.settings-theme-option .material-symbols-outlined → .settings-theme-option [class^="ri-"]
```

- [ ] **Step 12: 验证**

```bash
pnpm build && pnpm test
```

预期：构建成功、测试全绿。`grep -rn "material-symbols" src/` 仅剩 **3 个文件的预期残留**：`HeroCategoryCards.vue`（Task 3 处理）、`styles/global.css`（Task 4 处理）、`styles/fonts.css`（Task 4 重新生成）。

`pnpm dev:full` 手动抽查：登录页（品牌实心图标、输入框图标、密码眼睛切换、登录按钮箭头）、顶栏（品牌/设置/添加/头像）、搜索框（放大镜、清空 ×）、滚动提示双箭头、第二屏（标题图标、筛选、添加按钮、书签卡箭头、空态）、模态框关闭 ×、右键菜单（编辑/复制/删除）、设置面板全部图标。深浅两主题各过一遍。

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor: UI图标替换为Remix Icon"
```

---

### Task 3: 分类图标链路切换（emoji → ri 名，TDD）

**Files:**
- Test: `src/constants/categoryIcons.test.js`（新建）
- Create: `src/constants/categoryIcons.js`
- Create: `src/components/common/IconPicker.vue`（由 `EmojiPicker.vue` 重命名）
- Delete: `src/components/common/EmojiPicker.vue`
- Modify: `src/components/category/CategoryForm.vue`
- Modify: `src/views/Home.vue`（分类相关 script 与模板）
- Modify: `src/components/hero/HeroCategoryCards.vue`
- Modify: `src/styles/components.css`（emoji-picker 样式改名）
- Create: `scripts/migrate-category-icons.sql`

**Interfaces:**
- Produces:
  - `CATEGORY_ICONS: string[]`（32 个 `ri-*` 名，IconPicker 预设）
  - `CATEGORY_ICON_DEFAULT = 'ri-folder-line'`
  - `resolveCategoryIcon(icon: unknown): string` —— `icon` 为 `ri-` 开头字符串则原样返回，否则返回默认值
  - `<IconPicker :icons="string[]" v-model="string">`
- 数据约定：此后 `categories.icon` 字段值域为 `ri-*` 图标名。

- [ ] **Step 1: 写失败测试**

新建 `src/constants/categoryIcons.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { CATEGORY_ICONS, CATEGORY_ICON_DEFAULT, resolveCategoryIcon } from './categoryIcons'

describe('categoryIcons', () => {
  it('预设清单全部为 ri- 开头且含默认图标', () => {
    expect(CATEGORY_ICONS.length).toBe(32)
    CATEGORY_ICONS.forEach(name => expect(name.startsWith('ri-')).toBe(true))
    expect(CATEGORY_ICONS).toContain(CATEGORY_ICON_DEFAULT)
  })

  it('ri- 开头的图标名原样返回', () => {
    expect(resolveCategoryIcon('ri-home-line')).toBe('ri-home-line')
  })

  it('旧 emoji、空值与非法值回退默认图标', () => {
    expect(resolveCategoryIcon('📁')).toBe(CATEGORY_ICON_DEFAULT)
    expect(resolveCategoryIcon('')).toBe(CATEGORY_ICON_DEFAULT)
    expect(resolveCategoryIcon(undefined)).toBe(CATEGORY_ICON_DEFAULT)
    expect(resolveCategoryIcon(123)).toBe(CATEGORY_ICON_DEFAULT)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test src/constants/categoryIcons.test.js
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 实现 constants/categoryIcons.js**

```js
// 分类预设图标（Remix Icon 名称，https://remixicon.com/）
// 顺序与语义对应旧版 emoji 预设（📁🏠💻📱🔧📚🎵…），供 IconPicker 与迁移参考
export const CATEGORY_ICONS = [
  'ri-folder-line', 'ri-home-line', 'ri-computer-line', 'ri-smartphone-line',
  'ri-tools-line', 'ri-book-2-line', 'ri-music-2-line', 'ri-palette-line',
  'ri-camera-line', 'ri-shopping-cart-line', 'ri-wallet-3-line', 'ri-bar-chart-box-line',
  'ri-link', 'ri-star-line', 'ri-rocket-line', 'ri-focus-3-line',
  'ri-pushpin-line', 'ri-search-line', 'ri-file-text-line', 'ri-alarm-line',
  'ri-global-line', 'ri-cloud-line', 'ri-lock-line', 'ri-mail-line',
  'ri-chat-3-line', 'ri-team-line', 'ri-building-2-line', 'ri-earth-line',
  'ri-gamepad-line', 'ri-heart-line', 'ri-fire-line', 'ri-lightbulb-line'
]

export const CATEGORY_ICON_DEFAULT = 'ri-folder-line'

// icon 为 ri- 开头的 Remix 名则直接使用；旧数据（emoji 等）回退默认图标
export function resolveCategoryIcon(icon) {
  return typeof icon === 'string' && icon.startsWith('ri-') ? icon : CATEGORY_ICON_DEFAULT
}
```

- [ ] **Step 4: 运行确认通过**

```bash
pnpm test src/constants/categoryIcons.test.js
```

预期：PASS（3 个用例）。

- [ ] **Step 5: EmojiPicker 重命名为 IconPicker**

```bash
git mv src/components/common/EmojiPicker.vue src/components/common/IconPicker.vue
```

重写 `src/components/common/IconPicker.vue` 全文：

```vue
<template>
  <div class="icon-picker">
    <div
      v-for="icon in icons"
      :key="icon"
      class="icon-item"
      :class="{ active: modelValue === icon }"
      @click="$emit('update:modelValue', icon)"
    >
      <i :class="icon"></i>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icons: {
    type: Array,
    required: true
  },
  modelValue: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue'])
</script>
```

- [ ] **Step 6: components.css 样式改名**

`src/styles/components.css` 约 385-418 行，注释与选择器改名（声明块不动）：

```
/* ── Emoji 选择器 ── */                       → /* ── 图标选择器 ── */
.emoji-picker {                                 → .icon-picker {
.emoji-picker .emoji-item {                     → .icon-picker .icon-item {
.emoji-picker .emoji-item:hover {               → .icon-picker .icon-item:hover {
.emoji-picker .emoji-item.active {              → .icon-picker .icon-item.active {
```

`.icon-picker .icon-item` 声明块中 `font-size: var(--icon-size-lg);` 保留（Remix 字体同样按 font-size 缩放）。

- [ ] **Step 7: 适配 CategoryForm.vue**

```vue
<!-- 模板：图标区（原 <EmojiPicker :emojis="emojis" ... />） -->
<IconPicker
  :icons="icons"
  :model-value="form.icon"
  @update:model-value="form.icon = $event"
/>
```

script 部分：

```js
// 原
import EmojiPicker from '../common/EmojiPicker.vue'
// 新
import IconPicker from '../common/IconPicker.vue'

// 原
  category: { type: Object, default: null },
  colors: { type: Array, required: true },
  emojis: { type: Array, required: true },
  loading: { type: Boolean, default: false }
// 新
  category: { type: Object, default: null },
  colors: { type: Array, required: true },
  icons: { type: Array, required: true },
  loading: { type: Boolean, default: false }

// form 默认值与 watch 回退：'📁' → 'ri-folder-line'（两处）
  icon: 'ri-folder-line',
```

- [ ] **Step 8: 改 Home.vue 分类链路**

script：

```js
// 新增 import（与其他 src 导入放一起）
import { CATEGORY_ICONS, resolveCategoryIcon } from '../constants/categoryIcons'

// 删除整个 presetEmojis 数组（189-194 行），替换为：
const presetIcons = CATEGORY_ICONS

// 删除 ICON_FALLBACK 常量与注释（196-198 行）
// 删除整个 iconForCategory 函数（261-290 行）
```

`heroCategories` computed 内：

```js
// 原
    icon: 'apps',
// 新
    icon: 'ri-apps-2-line',

// 原
      icon: iconForCategory(c, idx),
// 新
      icon: resolveCategoryIcon(c.icon),
```

模板（约 111 行）：

```vue
<!-- 原 -->
        :emojis="presetEmojis"
<!-- 新 -->
        :icons="presetIcons"
```

- [ ] **Step 9: 改 HeroCategoryCards.vue**

第 13-15 行：

```vue
<!-- 原 -->
        <span class="hero-category-icon">
          <span class="material-symbols-outlined">{{ cat.icon }}</span>
        </span>
<!-- 新 -->
        <span class="hero-category-icon">
          <i :class="cat.icon"></i>
        </span>
```

- [ ] **Step 10: 写迁移 SQL 并本地执行**

新建 `scripts/migrate-category-icons.sql`（UTF-8 保存；幂等，可重复执行）：

```sql
-- 分类图标迁移：emoji → Remix Icon 名（与 src/constants/categoryIcons.js 语义对应）
UPDATE categories SET icon='ri-folder-line'        WHERE icon='📁';
UPDATE categories SET icon='ri-home-line'          WHERE icon='🏠';
UPDATE categories SET icon='ri-computer-line'      WHERE icon='💻';
UPDATE categories SET icon='ri-smartphone-line'    WHERE icon='📱';
UPDATE categories SET icon='ri-tools-line'         WHERE icon='🔧';
UPDATE categories SET icon='ri-book-2-line'        WHERE icon='📚';
UPDATE categories SET icon='ri-music-2-line'       WHERE icon='🎵';
UPDATE categories SET icon='ri-palette-line'       WHERE icon='🎨';
UPDATE categories SET icon='ri-camera-line'        WHERE icon='📷';
UPDATE categories SET icon='ri-shopping-cart-line' WHERE icon='🛒';
UPDATE categories SET icon='ri-wallet-3-line'      WHERE icon='💰';
UPDATE categories SET icon='ri-bar-chart-box-line' WHERE icon='📊';
UPDATE categories SET icon='ri-link'               WHERE icon='🔗';
UPDATE categories SET icon='ri-star-line'          WHERE icon='⭐';
UPDATE categories SET icon='ri-rocket-line'        WHERE icon='🚀';
UPDATE categories SET icon='ri-focus-3-line'       WHERE icon='🎯';
UPDATE categories SET icon='ri-pushpin-line'       WHERE icon='📌';
UPDATE categories SET icon='ri-search-line'        WHERE icon='🔍';
UPDATE categories SET icon='ri-file-text-line'     WHERE icon='📝';
UPDATE categories SET icon='ri-alarm-line'         WHERE icon='⏰';
UPDATE categories SET icon='ri-global-line'        WHERE icon='🌐';
UPDATE categories SET icon='ri-cloud-line'         WHERE icon='☁️';
UPDATE categories SET icon='ri-lock-line'          WHERE icon='🔒';
UPDATE categories SET icon='ri-mail-line'          WHERE icon='📧';
UPDATE categories SET icon='ri-chat-3-line'        WHERE icon='💬';
UPDATE categories SET icon='ri-team-line'          WHERE icon='👥';
UPDATE categories SET icon='ri-building-2-line'    WHERE icon='🏢';
UPDATE categories SET icon='ri-earth-line'         WHERE icon='🌍';
UPDATE categories SET icon='ri-gamepad-line'       WHERE icon='🎮';
UPDATE categories SET icon='ri-heart-line'         WHERE icon='❤️';
UPDATE categories SET icon='ri-fire-line'          WHERE icon='🔥';
UPDATE categories SET icon='ri-lightbulb-line'     WHERE icon='💡';
-- 变体选择符兼容（部分来源可能存为不带 U+FE0F 的形式）
UPDATE categories SET icon='ri-cloud-line'         WHERE icon='☁';
UPDATE categories SET icon='ri-heart-line'         WHERE icon='❤';
```

执行（本地 D1，与 `wrangler pages dev` 共用 `.wrangler/state` 本地持久化）：

```bash
wrangler d1 execute nav-db --local --file=scripts/migrate-category-icons.sql
```

- [ ] **Step 11: 验证**

```bash
pnpm build && pnpm test
```

预期：构建成功、测试全绿（含新 categoryIcons 用例）。

```bash
wrangler d1 execute nav-db --local --command="SELECT id, icon FROM categories"
```

预期：所有 icon 均为 `ri-` 开头。

`pnpm dev:full` 手动验证：第一屏分类卡片图标正确显示（不再是 emoji 映射）；「全部」卡片为 `ri-apps-2-line`；右键分类 → 编辑 → 表单 IconPicker 高亮当前图标、可换选保存；新建分类默认 `ri-folder-line`；书签右键菜单正常。`grep -rn "material-symbols" src/` 仅剩 `styles/global.css` 与 `styles/fonts.css`（Task 4 处理）。

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: 分类图标切换为Remix Icon并迁移数据"
```

---

### Task 4: Material Symbols 清退与脚本瘦身

**Files:**
- Modify: `scripts/generate-fonts.mjs`
- Modify: `src/styles/global.css`
- Modify: `src/styles/variables.css`
- Delete: `src/assets/fonts/material-symbols-subset-*.woff2`（重跑脚本后确认）
- Modify: `CLAUDE.md`（nav-manager 项目级）

**Interfaces:**
- Consumes: Task 2/3 完成后全站已无 `.material-symbols-outlined` 使用（`grep -rn "material-symbols" src/` 仅剩样式残留）。
- Produces: `generate-fonts.mjs` 仅负责正文字体；`fonts.css` 不再含图标字体。

- [ ] **Step 1: 重写 generate-fonts.mjs（仅正文字体）**

全文替换为：

```js
// 字体本地化生成脚本：请求 Google Fonts 子集 CSS，下载 woff2，重写 src/styles/fonts.css
// 用法：node scripts/generate-fonts.mjs（需可访问 fonts.googleapis.com）
// 图标已改用 remixicon npm 包（见 src/main.js 引入），本脚本仅负责正文字体
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src/assets/fonts');
const CSS_OUT = path.join(ROOT, 'src/styles/fonts.css');

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

  // 正文字体（latin + latin-ext 子集；中文由系统字体回退，Google 家族本无中文字形）
  let bodyCss = '';
  for (const fam of FAMILIES) {
    bodyCss += await fetchCss(`https://fonts.googleapis.com/css2?family=${fam}&display=swap`) + '\n';
  }
  const blocks = bodyCss.split(/\n(?=\/\*)/).filter(b => /^\/\*\s*(latin|latin-ext)\s*\*\//.test(b.trim()));
  console.log('正文 @font-face 块（latin/latin-ext）:', blocks.length);
  const allCss = '/* 正文字体（latin/latin-ext 子集，中文回退系统字体） */\n' + blocks.join('\n') + '\n';

  // 提取字体 URL 并下载，重写 CSS 指向本地
  const urls = [...allCss.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
  const seen = new Map();
  let i = 0;
  for (const url of urls) {
    if (seen.has(url)) continue;
    const label = url.match(/\/s\/([a-z0-9]+)\//i)?.[1] || 'font';
    const file = `${label}-${++i}.woff2`;
    const size = await download(url, path.join(OUT_DIR, file));
    allCss = allCss.split(url).join(`../assets/fonts/${file}`);
    seen.set(url, file);
    console.log(`  ${file}  ${(size / 1024).toFixed(1)} KB`);
  }
  console.log(`共下载 ${seen.size} 个字体文件`);

  // 校验：CSS 中不得残留远程字体引用
  const remote = allCss.match(/url\((https:[^)]+)\)/);
  if (remote) throw new Error(`仍存在远程字体引用: ${remote[1]}`);

  fs.writeFileSync(CSS_OUT, allCss);
  console.log('fonts.css 已生成:', CSS_OUT);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
```

- [ ] **Step 2: 重跑脚本并清理图标字体文件**

```bash
node scripts/generate-fonts.mjs
```

预期：fonts.css 重新生成、仅含正文字体块。然后删除 Material 图标子集字体：

```bash
rm src/assets/fonts/material-symbols-subset-*.woff2
```

（若重跑后仍存在其他未被引用的旧 woff2，对照新 fonts.css 引用清单一并清理。）

- [ ] **Step 3: 清理 global.css 工具类与 variables.css 变量**

`src/styles/global.css` 130-146 行整块替换：

```css
/* 原：── Material Symbols 工具类 ── 及 .material-symbols-outlined { … } 整块 */
/* 新 */
/* ── Remix Icon 补充（基础字体定义由 remixicon.css 提供） ── */
[class^="ri-"] {
  user-select: none;
}
```

`src/styles/variables.css` 164 行删除：

```css
  --font-icon: 'Material Symbols Outlined';
```

- [ ] **Step 4: 更新 CLAUDE.md（nav-manager）**

- 「常用命令」段：`node scripts/generate-fonts.mjs` 注释 `字体/图标子集再生成（需可访问 fonts.googleapis.com）` → `正文字体子集再生成（需可访问 fonts.googleapis.com）`
- 「核心设计」段「预设数据」条目：`分类支持预设的 Emoji 图标和 10 种常用颜色` → `分类支持预设的 Remix Icon 图标（\`src/constants/categoryIcons.js\`）和 10 种常用颜色`
- 「核心设计」段「字体/图标本地化」条目整句替换为：

```
- **字体/图标本地化**: 正文字体子集本地化于 `src/assets/fonts/`（`scripts/generate-fonts.mjs` 生成）；图标使用 remixicon npm 包（Apache 2.0），全量字体经 Vite 本地打包，无外部 CDN。新增图标直接写 `ri-xxx-line` class（对照 https://remixicon.com/），无需重跑脚本
```

- 检查 `README.md`、`API.md` 是否有 Material Symbols / ICON_NAMES / emoji 图标相关描述（`grep -n -i -E "material|ICON_NAMES|emoji" README.md API.md`），有则同步更正，没有则跳过。

- [ ] **Step 5: 验证**

```bash
pnpm build && pnpm test
grep -rn -i -E "material-symbols|material symbols|ICON_FALLBACK|symbolMap|EmojiPicker" src/ scripts/ CLAUDE.md README.md API.md
```

预期：构建成功、测试全绿、grep 无任何输出（Material 彻底清退）。

`pnpm dev:full` 全站过一遍（深浅两主题），确认无图标缺失/方块。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: 移除Material Symbols字体与子集脚本"
```

---

### Task 5: 终验

**Files:** 无新增改动（纯验证；发现问题回上游任务修复）。

- [ ] **Step 1: 全量测试与构建**

```bash
pnpm test && pnpm build
```

预期：全部测试通过、构建成功。

- [ ] **Step 2: 构建产物检查**

```bash
ls dist/assets/*.woff2 && grep -c "ri-" dist/assets/*.css | head
```

预期：dist 内含本地化 woff2（正文 + remixicon），CSS 中含 ri- 类定义。

- [ ] **Step 3: 手动验收清单（dev:full，深浅两主题）**

- 登录页：品牌实心书签图标、@/锁输入框图标、密码眼睛切换、成功勾、箭头
- 顶栏：品牌、设置齿轮、+、头像占位
- 第一屏：统计图标、搜索、清空 ×、分类卡片图标（含「全部」）、滚动双箭头
- 第二屏：标题、筛选、添加、分类 pill、书签卡箭头、空态
- 交互：书签/分类右键菜单、模态框关闭、设置面板（头像占位、上传、日月、导入导出、退出）
- 分类表单：IconPicker 网格显示 32 个图标、选中高亮、默认值

- [ ] **Step 4: 数据抽查**

```bash
wrangler d1 execute nav-db --local --command="SELECT id, name, icon FROM categories"
```

预期：全部 icon 为 `ri-` 开头。

- [ ] **Step 5: 收尾**

若前面任务均已提交且本任务无改动，无需提交；有修补则 `git add -A && git commit -m "fix: 修复图标迁移遗留问题"`。
