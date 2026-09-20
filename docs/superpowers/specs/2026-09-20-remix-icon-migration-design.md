# 设计：图标系统迁移到 Remix Icon

- 日期：2026-09-20
- 状态：已确认（方案 A：全量字体引入）
- 范围：UI 图标（Material Symbols）与分类图标（emoji）整体替换为 Remix Icon

## 背景与目标

当前项目存在两套并行的图标系统：

1. **UI 图标**：Material Symbols Outlined 可变字体子集，由 `scripts/generate-fonts.mjs` 从
   Google Fonts 拉取并本地化到 `src/assets/fonts/`；用法 `<span class="material-symbols-outlined">name</span>`，
   分布于 10+ 组件、50+ 处引用，另有 3 个 CSS 文件约 30 处选择器。
2. **分类图标**：DB `categories.icon` 存 emoji 字符，`EmojiPicker` 预设 16 个；
   渲染时经 `Home.vue` 的 `symbolMap`（24 条）映射为 Material 图标名，未匹配回退 `ICON_FALLBACK`（`folder`）。

目标：统一替换为 [Remix Icon](https://remixicon.com/)（Apache 2.0，2800+ 图标，line/fill 双变体），
简化渲染链路（分类图标直接存 `ri-*` 名直接渲染，删除映射层）。

## 决策记录

- **引入方式**：npm 包 `remixicon` 全量字体（方案 A）。woff2 约 300KB，一次性加载后走浏览器缓存；
  自用单用户场景无感知，实现与后续维护成本最低（新增图标零成本，不再依赖子集脚本）。
  已否决：B 子集字体（需引入子集工具链，收益小）；C SVG 按需组件（分类图标需维护名字→组件映射）。
- **风格**：全部使用 `-line` 变体，与现有 outline 风格一致；登录页品牌图标唯一一处实心用 `-fill` 变体。
- **后端校验**：`functions/utils/validate.js` 维持 optional string 宽松校验不变。

## 设计详情

### 1. 依赖与引入

- `pnpm add remixicon`
- `src/main.js` 引入 `remixicon/fonts/remixicon.css`（woff2 经 Vite 自动本地化打包，无外部 CDN）
- 图标元素统一写法 `<i class="ri-xxx-line"></i>`

### 2. UI 图标替换

- 50+ 处 `<span class="material-symbols-outlined">name</span>` 按下方映射表机械替换。
- CSS 选择器 `.material-symbols-outlined` 统一改为属性选择器 `[class^="ri-"], [class*=" ri-"]`
  （Remix 官方推荐的扩展方式），如 `.modal-close .material-symbols-outlined` → `.modal-close [class^="ri-"]`。
- `layout.css` 中 `font-variation-settings: 'FILL' 1`（登录页品牌图标，唯一一处）改用 `-fill` 变体图标名，删除该声明。
- `global.css` 中 `.material-symbols-outlined` 基础样式（尺寸/行高）改写为属性选择器版本；
  `fonts.css` 由重跑后的脚本重新生成，Material 块自然消失。
- 右键菜单：`Home.vue` 传入 ContextMenu 的 `icon` 值（`edit`/`delete` 等）同步换成 ri 名；
  `ContextMenu.vue` 模板仅改元素与 class。

**UI 图标映射表**（Material → Remix；个别名实施时对照官网核实）：

| Material | Remix |
|---|---|
| add | ri-add-line |
| add_a_photo | ri-image-add-line |
| alternate_email | ri-at-line |
| analytics | ri-bar-chart-box-line |
| arrow_forward | ri-arrow-right-line |
| arrow_outward | ri-external-link-line |
| bookmark_heart | ri-bookmark-3-line（登录页实心用 ri-bookmark-3-fill） |
| bookmarks | ri-bookmark-line |
| build | ri-tools-line |
| business | ri-building-2-line |
| chat | ri-chat-3-line |
| check_circle | ri-checkbox-circle-line |
| close | ri-close-line |
| cloud | ri-cloud-line |
| content_copy | ri-file-copy-line |
| delete | ri-delete-bin-line |
| dark_mode | ri-moon-line |
| download | ri-download-line |
| edit | ri-edit-line |
| favorite | ri-heart-line |
| filter_alt | ri-filter-3-line |
| folder | ri-folder-line |
| group | ri-team-line |
| home | ri-home-line |
| keyboard_double_arrow_down | ri-arrow-down-double-line |
| light_mode | ri-sun-line |
| lightbulb | ri-lightbulb-line |
| link | ri-link |
| local_fire_department | ri-fire-line |
| lock | ri-lock-line |
| logout | ri-logout-box-r-line |
| menu_book | ri-book-2-line |
| music_note | ri-music-2-line |
| palette | ri-palette-line |
| payments | ri-wallet-3-line |
| person | ri-user-line |
| photo_camera | ri-camera-line |
| public | ri-global-line |
| push_pin | ri-pushpin-line |
| rocket_launch | ri-rocket-line |
| search | ri-search-line |
| settings | ri-settings-line |
| sports_esports | ri-gamepad-line |
| star | ri-star-line |
| terminal | ri-terminal-box-line |
| upload | ri-upload-line |
| visibility | ri-eye-line |
| visibility_off | ri-eye-off-line |

### 3. 分类图标子系统

- **预设清单**：约 26 个 `ri-*-line` 名单（见下），收敛为独立常量文件 `src/constants/categoryIcons.js`，
  供 `Home.vue`（传给表单）与迁移脚本参考共用语义。
  清单：`ri-folder-line, ri-home-line, ri-computer-line, ri-smartphone-line, ri-tools-line,
  ri-book-2-line, ri-music-2-line, ri-palette-line, ri-rocket-line, ri-star-line, ri-search-line,
  ri-camera-line, ri-wallet-3-line, ri-bar-chart-box-line, ri-link, ri-pushpin-line, ri-global-line,
  ri-cloud-line, ri-chat-3-line, ri-team-line, ri-building-2-line, ri-gamepad-line, ri-heart-line,
  ri-fire-line, ri-lightbulb-line, ri-terminal-box-line`
- **组件**：`EmojiPicker.vue` 重命名为 `IconPicker.vue`，内部渲染 `<i :class="icon">`，props 改为
  `icons` / `modelValue`；`components.css` 中相关样式类名同步改名（`.emoji-picker` → `.icon-picker` 等）。
- **渲染简化**：删除 `Home.vue` 的 `symbolMap` 与 `ICON_FALLBACK`；`iconForCategory(cat)` 简化为
  「`cat.icon` 以 `ri-` 开头则原样返回，否则回退 `ri-folder-line`」。分类 pill、第一屏分类卡片、
  表单、右键菜单等处直接渲染 icon 字段。
- `CategoryForm.vue` 默认 icon `'📁'` → `'ri-folder-line'`。

### 4. 存量数据迁移

- 新增幂等迁移 SQL `scripts/migrate-category-icons.sql`，按下方 emoji → ri 映射生成
  `UPDATE categories SET icon='ri-xxx-line' WHERE icon='📁';` 形式的语句集合。
- 映射覆盖 `symbolMap`（24 条）∪ `presetEmojis`（16 条）的并集，以实际读取的完整清单为准。
- emoji 变体选择符：`☁️`/`❤️` 等在 DB 中可能存为带或不带 U+FE0F 两种形式，SQL 中两种形式都要覆盖。
- 本地执行：`wrangler d1 execute nav-db --local --file=scripts/migrate-category-icons.sql`。
  线上从未部署，无需远程迁移；SQL 保留备用。
- 前端兜底：非 `ri-` 开头的 icon 渲染为默认图标，迁移遗漏不显示方块。

emoji → ri 迁移映射：

| emoji | ri |
|---|---|
| 📁 | ri-folder-line |
| 🏠 | ri-home-line |
| 💻 | ri-computer-line |
| 📱 | ri-smartphone-line |
| 🔧 | ri-tools-line |
| 📚 | ri-book-2-line |
| 🎵 | ri-music-2-line |
| 🎨 | ri-palette-line |
| 🚀 | ri-rocket-line |
| ⭐ | ri-star-line |
| 🔍 | ri-search-line |
| 📷 | ri-camera-line |
| 💰 | ri-wallet-3-line |
| 📊 | ri-bar-chart-box-line |
| 🔗 | ri-link |
| 📌 | ri-pushpin-line |
| 🌐 | ri-global-line |
| ☁️ | ri-cloud-line |
| 💬 | ri-chat-3-line |
| 👥 | ri-team-line |
| 🏢 | ri-building-2-line |
| 🎮 | ri-gamepad-line |
| ❤️ | ri-heart-line |
| 🔥 | ri-fire-line |
| 💡 | ri-lightbulb-line |

### 5. 字体脚本与文档收尾

- `generate-fonts.mjs` 删除图标子集逻辑（`ICON_NAMES`、图标 CSS 拉取与下载、图标相关注释），
  只保留正文字体（JetBrains Mono / Plus Jakarta Sans / Space Grotesk）下载与重写。
- 重跑脚本重新生成 `fonts.css`；从 `src/assets/fonts/` 删除 Material 图标子集字体文件
  （`material-symbols-subset-*.woff2`）。
- 更新项目 `CLAUDE.md`「字体/图标本地化」段落：图标来自 remixicon npm 包，新增图标名零成本、
  无需再跑脚本；移除「新增图标名必须补入 ICON_NAMES」的约定。

### 6. 测试与验证

- 现有 vitest 测试保持全绿（无图标相关用例，预期不受影响）。
- `pnpm build` 通过、产物含本地 woff2。
- 手动验证清单（`pnpm dev:full`，深浅色两主题各过一遍）：
  - 登录页：品牌图标（实心）、输入框图标、密码可见性切换、提示勾
  - 第一屏：搜索、分类卡片图标、滚动提示箭头、统计区图标
  - 第二屏：分类 pill 图标、筛选/添加按钮、书签卡箭头、空态图标
  - 交互：右键菜单（编辑/删除）、模态框关闭、设置面板全部图标
  - 分类编辑表单：IconPicker 选择、默认值、存量分类显示迁移后图标
- 迁移后抽查 D1：`wrangler d1 execute nav-db --local --command="SELECT id, icon FROM categories"`，
  全部为 `ri-` 开头。

## 风险与备注

- Remix 图标名以官网为准，映射表中个别名（`ri-image-add-line`、`ri-arrow-down-double-line`、
  `ri-tools-line`、`ri-bookmark-3-line`、`ri-filter-3-line`、`ri-bar-chart-box-line`、
  `ri-wallet-3-line`、`ri-terminal-box-line`）在实施首步统一核对，不存在则就近替换。
- `ri-link` 无 line/fill 变体后缀，是 Remix 中少数不带变体的图标名，属性选择器不受影响。
- 迁移 SQL 中 emoji 字面量需以 UTF-8 保存，执行前先在本地验证 WHERE 命中行数。
