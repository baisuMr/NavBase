# NavManager 前端页面重设计（Tabular Minimalist）

- 日期：2026-09-21
- 状态：已确认
- 参考稿：`E:\mzheng\网址导航工具\stitch_1\`（DESIGN.md、登录页.html、主页.html）

## 1. 背景与目标

将 NavManager 前端从现有「深色玻璃拟态 + 翡翠绿」视觉体系，整体重设计为参考稿定义的
「Tabular Minimalist」体系：**纯浅色、扁平无阴影、Slate 中性色 + 皇家蓝 #2563EB**。
登录页与主页完全参考 stitch_1 的布局与样式；数据层（stores / composables / api）与后端
基本不动；组件结构适度简化。

已确认的关键决策：

1. **只保留浅色主题**：移除深色主题、useTheme、设置面板中的外观切换。
2. **首屏快捷卡片**：取排序前 5 个书签展示，不新增数据模型。
3. **组件化适度简化**：首屏的时钟/搜索/快捷卡片内联进 Home.vue；Modal、ContextMenu 等
   通用组件保留。
4. **实现记住设备**：勾选 = 30 天免登录；不勾选 = 关闭浏览器即失效（sessionStorage）。

## 2. 设计语言规范

### 2.1 色彩 Token（重写 `src/styles/variables.css`）

| Token | 值 | 用途 |
|---|---|---|
| `--color-surface` | `#F8FAFC` | 页面画布 |
| `--color-surface-card` | `#FFFFFF` | 卡片、弹窗、输入聚焦底 |
| `--color-surface-muted` | `#F1F5F9` | hover 底、徽章底、输入框底、快捷卡片书签卡底 |
| `--color-border` | `#E2E8F0` | 常规 1px 结构边框 |
| `--color-border-strong` | `#CBD5E1` | hover 边框、输入框边框 |
| `--color-border-active` | `#94A3B8` | 弹窗边界 |
| `--color-text` | `#0F172A` | 主文字 |
| `--color-text-secondary` | `#334155` | 次文字、标签 |
| `--color-text-muted` | `#64748B` | 域名、弱文字、图标 |
| `--color-text-disabled` | `#94A3B8` | 禁用态、placeholder |
| `--color-primary` | `#2563EB` | 主色 |
| `--color-primary-hover` | `#1D4ED8` | 主按钮 hover |
| `--color-primary-active` | `#1E40AF` | 主按钮 active |
| `--color-primary-soft` | `#EFF6FF` | 激活筛选底（蓝 50） |
| `--color-primary-soft-border` | `#BFDBFE` | 激活筛选边框 |
| `--color-primary-ring` | `rgba(37, 99, 235, 0.15)` | 聚焦环 |
| `--color-success` | `#059669` | 成功/同步指示 |
| `--color-error` | `#DC2626` | 错误 |
| `--color-error-soft` | `#FEF2F2` | 错误浅底 |
| `--color-overlay` | `rgba(15, 23, 42, 0.4)` | 弹窗遮罩（无模糊） |

分类预设 10 色（翡翠/靛蓝/紫/粉/红/橙/琥珀/青/蓝/灰）保留，仅用于分类表单图标配色。

### 2.2 字体

- `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif`
- `--font-mono: 'JetBrains Mono', 'SF Mono', 'PingFang SC', 'Microsoft YaHei', monospace`
- 移除 Space Grotesk；`scripts/generate-fonts.mjs` 的 FAMILIES 改为
  `Inter:wght@400;500;600` + `JetBrains+Mono:wght@400;500`，重跑生成 fonts.css 与 woff2。
- **回退**：若网络不可访问 fonts.googleapis.com，保留现有字体（Plus Jakarta Sans 等），
  仅改字体栈引用，不阻塞整体改造。

### 2.3 圆角 / 间距 / 阴影

- 圆角：`--radius-xs: 4px`（控件、标签、键帽）、`--radius-sm: 6px`（分类 tab）、
  `--radius-md: 12px`（书签卡、快捷卡、登录卡）、`--radius-lg: 16px`（搜索框）；
  favicon 容器 8px 圆角方形；头像圆形。
- 间距：4px 网格——`--space-xs: 4px`、`--space-sm: 8px`、`--space-md: 12px`、
  `--space-lg: 16px`、`--space-xl: 24px`、`--space-2xl: 32px`。
- 阴影：仅两级——卡片 hover `0 1px 2px rgba(15,23,42,0.05)`；弹窗/下拉
  `0 2px 4px rgba(15,23,42,0.06)` + `0 12px 32px -8px rgba(15,23,42,0.12)`。
  **禁止**模糊阴影、彩色辉光、玻璃拟态、渐变背景。
- 内容容器：`max-width: 1024px` 居中，最小水平 padding 16px（移动端）/24px（桌面）。

### 2.4 首屏背景

画布 `#F8FAFC` + 点阵：`background-image: radial-gradient(#CBD5E1 1.2px, transparent 1.2px); background-size: 24px 24px`。

## 3. 页面设计

### 3.1 登录页（重写 `src/views/Login.vue`）

全屏居中，纯色 `#F8FAFC` 画布（无点阵）：

- 卡片：max-width 440px，白底、12px 圆角、`1px solid #E2E8F0` 边框 + 弹窗级微阴影，
  padding 24px（移动）/40px（桌面）。
- 品牌区（居中）：48px 蓝色方块（`#2563EB`、12px 圆角，内 `ri-flash-fill` 白色 24px）
  → 标题「欢迎登录 {站点名}」24px/600 → 副标题「同步你的书签资料库，打造极致纯净的起始页」
  13px `#64748B`。
- 表单（label 13px/500 主文字；输入框 40px 高、`#F1F5F9` 底、12px 圆角、无边框，
  聚焦白底 + `2px` 蓝环 `--color-primary-ring`；placeholder `#94A3B8`）：
  - 用户名（无左侧图标，参考稿样式）
  - 密码 + 右侧眼睛切换按钮（`ri-eye-line` / `ri-eye-off-line`，18px）
  - 「记住此设备（30天内免登录）」复选框：16px、白底 `#CBD5E1` 边框、4px 圆角，
    选中蓝底白勾（`ri-check-line` 12px）；**默认勾选**。
  - 错误信息：12px `#DC2626`。
  - 提交按钮：40px 蓝底白字 13px/500、12px 圆角、hover `#1D4ED8`、active 缩放 0.98；
    三态：默认「立即登录 + 箭头」→ 加载（spinner + 「正在登录...」）→ 成功
    （`ri-check-line` + 「登录成功」，500ms 后跳转 `/`）。
- 记住设备语义：勾选 → 30 天（token 存 localStorage）；不勾选 → 会话级（token 存
  sessionStorage，后端有效期 `LOGIN_DURATION_DAYS`，默认 7 天，作为兜底）。

### 3.2 主页（重写 `src/views/Home.vue`）

#### 顶栏（重写 AppHeader.vue）

sticky 顶部，56px 高，白底 + `1px solid #E2E8F0` 下边框，内容 max-width 1024px：

- 左：28px 蓝色圆角方块（`ri-flash-fill` 白色）+ 站点名（14px/600，主文字色）。
- 右：`?` 快捷键帮助按钮（`ri-question-line`，打开 ShortcutHelp 弹窗）→ 设置齿轮
  （`ri-settings-line`）→ 头像 28px 圆（有头像显示图片，无则深底 `#0F172A` 白字首字母）。
- 所有图标按钮：28px 见方、`#64748B` 色、hover 浅灰底 `#F1F5F9` + 主文字色、4px 圆角。
- 移除：导航链接（Overview / Collections）、GitHub 图标（项目无仓库地址）、添加按钮。

#### 首屏（内联于 Home.vue）

`min-height: calc(100vh - 56px)`，flex 垂直居中，点阵背景，内容宽度不受 1024px 限制
（时钟与搜索按自身 max-width 居中）：

- **时钟**：`--font-mono`，`HH:MM` `clamp(64px, 12vw, 128px)`/600 主文字色，
  `:SS` `clamp(28px, 4vw, 40px)`/500 `#94A3B8`，基线对齐；每秒刷新。
- **日期行**（13px `#64748B`，居中换行）：公历日期（500 `#334155`）→ 星期徽章
  （11px/600，蓝浅底 `#EFF6FF` + 蓝字 `#2563EB` + `#BFDBFE` 边框，4px 圆角）→ `•` 分隔
  → 农历 → `•` → 「第 N 周」徽章（11px mono，灰底 `#F1F5F9` + `#334155` 字 +
  `#E2E8F0` 边框）。
- **搜索框**（max-width 672px，padding 8px，白底 `1px solid #CBD5E1` 边框、16px 圆角、
  微阴影；聚焦蓝边框 + 4px 蓝环）：
  - 左：引擎下拉按钮（灰底 `#F1F5F9`、12px 圆角、padding 8px/12px）：8px 引擎色圆点 +
    引擎名 12px/500 + 下拉箭头 12px；点击展开引擎菜单（白卡、`#CBD5E1` 边框、微阴影、
    列表项 hover 灰底；点击选中并聚焦输入）。引擎列表与选择逻辑沿用
    `useSearchEngines`。
  - 中：无边框透明输入，14px 主文字色，placeholder `#94A3B8`「键入关键词或网页链接，
    按下 Enter 立即检索...」。站内结果下拉保留（白卡、12px 圆角、`#CBD5E1` 边框、
    微阴影；favicon + 标题 + URL，hover 灰底；末尾回车提示行）。
  - 右：`Ctrl` + `K` 两枚键帽（11px mono，灰底 `#F1F5F9` + `#E2E8F0` 边框 +
    `#64748B` 字，4px 圆角）。
- **快捷卡片行**（5 列，响应式 640px 以下 2 列、1024px 以下 3 列）：取书签列表前 5 个
  （与第二屏一致的 sort_order 排序）；白底、`#E2E8F0` 边框、12px 圆角、padding 8px/12px；
  favicon 容器 24px（8px 圆角，无 favicon 时首字回退）+ 标题 12px/600，截断；
  hover 蓝边框 + 微阴影，标题 hover 变蓝。无书签时整行隐藏。
- **滚动提示**：底部居中，12px `#94A3B8`「向下滚动查看书签库」+ `ri-arrow-down-line`
  弹跳动画，hover 变蓝，点击平滑滚动至第二屏。

#### 第二屏（重写 BookmarkExplorer.vue + BookmarkCard.vue）

`min-height: 100vh`，max-width 1024px：

- **头部行**（底部 `1px solid #E2E8F0` 分隔，两端对齐）：
  - 左：分类 tab——「全部」+ 各分类；padding 6px/12px、6px 圆角、12px/500；
    激活：深底 `#0F172A` + 白字；非激活：白底 `#E2E8F0` 边框 + `#334155` 字，
    hover 边框 `#CBD5E1` 字变主色；每个 tab 后跟计数徽章（10px mono：激活内
    `#334155` 底/浅字，非激活 `#F1F5F9` 底/`#64748B` 字）。行末「+」管理分类按钮
    （28px 见方、灰底边框，`ri-add-line`，打开分类表单）。右键菜单（编辑/删除分类）
    保留在 tab 上。
  - 右：「添加网址」按钮（蓝底白字 12px/500、8px 圆角、padding 6px/12px、
    `ri-add-line` 14px，hover `#1D4ED8`、active 缩放 0.98）。
- **书签网格**：grid，间距 14px；≥1024px 4 列、640–1023px 2 列、<640px 1 列。
  - 卡片（`<a>`，右键菜单保留）：灰底 `#F8FAFC` + `#E2E8F0` 边框、12px 圆角、
    padding 12px、横向排列；favicon 容器 36px（白底、`#E2E8F0` 边框、8px 圆角，favicon
    或首字回退）；标题 12px/600 主文字 + 域名 12px mono `#64748B`（均截断）；
    右侧 `ri-external-link-line` 14px `#CBD5E1`，hover 变蓝并微位移。
    hover 态：白底、蓝边框、上浮 2px、微阴影。
- **空状态**：居中 `ri-bookmark-line` 24px + 说明文字 13px `#64748B`
  （「该分类下暂无书签」/「暂无书签，点击右上角 + 添加」）。
- **移除**：第二屏筛选输入框与 `filter-text` 状态（首屏搜索已能检索书签）。

#### 页脚

白底 + 顶部 `1px solid #E2E8F0`，max-width 1024px，13px：

- 左：`{站点名} · {N} 个分类 · {N} 个书签`（站点名 500 `#334155`，其余 `#64748B`）。
- 右：「导入与导出」（打开设置面板）、「键盘快捷键」（打开 ShortcutHelp 弹窗）、
  版本号徽章（12px mono，灰底 `#F1F5F9` + `#E2E8F0` 边框全圆，读 package.json version）。

### 3.3 弹窗与通用组件（重做样式，接口不变）

- **Modal**：白卡、`#94A3B8` 边框、微阴影、遮罩 `rgba(15,23,42,0.4)` 无模糊；标题
  16px/600；关闭 `ri-close-line`。
- **ContextMenu**：白卡、`#CBD5E1` 边框、微阴影；菜单项 13px，hover 灰底，危险项红字。
- **ToastMessage**：白卡、边框、微阴影；成功 `ri-check-circle-line` 绿、错误
  `ri-error-warning-line` 红。
- **表单控件**（BookmarkForm / CategoryForm / SettingsPanel 内）：label 13px/500；
  输入框 36px、白底 `#CBD5E1` 边框、6px 圆角、聚焦蓝边框 + 蓝环；按钮 32px（紧凑）
  /38px（默认）；主按钮蓝底白字、次按钮白底边框、幽灵按钮透明 hover 灰底、危险红。
- **ShortcutHelp（新增）**：Modal 内表格列出 Ctrl+K / Alt+N / Alt+Shift+N / Escape
  四条快捷键，键帽样式与搜索框一致。

## 4. 组件与文件变更

### 4.1 合并进 Home.vue（删除原文件）

- `src/components/hero/HeroClock.vue`
- `src/components/hero/HeroSearch.vue`
- `src/components/hero/HeroCategoryCards.vue`
- `src/components/common/SearchEngineTabs.vue`（改为搜索框内下拉，内联）
- 删除 `src/components/hero/` 目录；删除 `src/composables/useTheme.js`

### 4.2 重写

- `src/styles/variables.css`（新 token，单浅色主题）
- `src/styles/global.css`（去光晕，加点阵背景、键帽、徽章等全局样式）
- `src/styles/layout.css`（新布局）
- `src/styles/components.css`（新组件样式）
- `src/views/Login.vue`、`src/views/Home.vue`
- `src/components/layout/AppHeader.vue`
- `src/components/bookmark/BookmarkExplorer.vue`、`BookmarkCard.vue`
- `src/components/common/Modal.vue`、`ContextMenu.vue`、`ToastMessage.vue`、
  `SettingsPanel.vue`（删除「外观」区）
- `src/components/bookmark/BookmarkForm.vue`、`src/components/category/CategoryForm.vue`、
  `src/components/common/IconPicker.vue`、`ColorPicker.vue`（表单内样式随组件 CSS）

### 4.3 新增 / 修改逻辑

- 新增 `src/components/common/ShortcutHelp.vue`
- `src/stores/auth.js`：`login(username, password, remember)`；remember=true 存
  localStorage，false 存 sessionStorage；`init()` 同时检查两处（localStorage 优先），
  登录时清理另一处。
- `src/composables/useAuth.js`：透传 remember。
- `functions/api/auth/login.js`：接受 `body.remember`（布尔，缺省 false）；
  `remember=true` → `REMEMBER_DURATION_DAYS`（新环境变量，默认 30 天）；
  `false` → `LOGIN_DURATION_DAYS`（默认 7 天）。响应增加 `remember` 字段。
- `wrangler.toml`：`[vars]` 增加 `REMEMBER_DURATION_DAYS = "30"`。
- `src/main.js`：移除 useTheme 应用（删除防闪色逻辑）。
- `scripts/generate-fonts.mjs`：FAMILIES 改为 Inter + JetBrains Mono，重跑生成。

### 4.4 不变

后端其余 API、stores（bookmarks/categories/settings）、composables（useSearchEngines、
useLunar、useFavicon、useKeyboard、useContextMenu、useToast、useBookmarks、
useCategories）、utils、router、数据库 schema。

## 5. 测试策略

- 更新 `src/stores/auth.test.js`：remember 分支（localStorage / sessionStorage 存储位置、
  remember 参数透传）。
- 后端登录接口无现有测试文件，本次不新增（改动为纯参数分支，由前端联调覆盖）。
- 其余测试（importBookmarks、categoryIcons、useLunar、functions 各测试）逻辑未动，
  应保持全绿。
- 验收：`pnpm test` 与 `pnpm build` 全绿；`pnpm dev:full` 启动真实环境，浏览器逐屏对照
  参考稿核对（顶栏/时钟/日期行/搜索框/快捷卡片/分类 tab/书签卡/页脚/登录页三态）。

## 6. 风险与回退

- **字体网络依赖**：重跑 generate-fonts.mjs 需访问 fonts.googleapis.com；失败则保留
  现有字体文件，仅调整字体栈引用（见 2.2），不影响交付。
- **Home.vue 体积**：内联三块 hero 后约 500 行；用分区注释组织，保持可读。
- **浅色单主题**：`useTheme` 删除后若有遗漏引用会构建报错，构建阶段即可发现。
