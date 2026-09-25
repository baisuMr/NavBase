# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

NavBase 是一个自用的网址导航管理平台，用于替代浏览器书签功能。前端 SPA 与 API 同部署于 Cloudflare Workers（Static Assets + Worker 脚本），数据存 D1，Basic Auth 单用户认证。

## 技术栈与约束

- **前端**: Vue 3 + JavaScript（不使用 TypeScript）
- **CSS**: 纯 CSS（不使用 Tailwind 等 CSS 框架）
- **农历**: lunar-javascript 体积大，经 `src/composables/useLunar.js` 动态 import 拆为独立 chunk，勿改回静态引入

## 常用命令

常规命令见 `package.json` scripts；部署与 D1 运维步骤见 `README.md`。

- `pnpm test <file>` 可直接透传参数运行单个测试文件，无需 `--`
- `node scripts/generate-fonts.mjs` 正文字体子集再生成（需可访问 fonts.googleapis.com）
- 向本地库灌入测试数据（可重复执行）：`pnpm exec wrangler d1 execute navbase-db --file=scripts/seed-test-data.sql`
- wrangler d1 默认操作本地库，**操作线上库必须追加 `--remote`**

## 开发流程

- **分支约定**：`main` 即线上（Cloudflare Workers Builds 仅监听 `main`，推送即自动构建部署）；日常开发在 `dev` 分支提交、推送（自动构建 dev 预览供人工验证，不影响生产），验证通过后合并 `dev` → `main` 上线；紧急修复可直推 `main`，之后把 `main` 合回 `dev` 保持同步
- **合并上线门禁**：合并 `dev` → `main` 前跑全量测试；改过 `schema.sql` 时先对生产与预览库执行对应迁移（加列类迁移对旧代码无害，须在新代码上线前完成；当前待执行：`migrations/2026-09-26-unique-bookmark-url.sql`），用法见 `migrations/` 脚本头部注释。部署配置需含测试门禁：Build command 应设为 `pnpm test && pnpm run build`（控制台 Settings → Build 配置；未配置则测试不阻断部署）
- **分支预览**：推送非生产分支会自动构建 Preview（稳定 URL `https://<分支名>-navbase.<账号子域>.workers.dev`，每个分支/PR 各有独立预览，dev 分支的预览即测试环境），配置在 `wrangler.toml` [previews] 块（独立预览 D1 库，不复用生产设置）。预览凭据一次配置持久生效：`wrangler preview base-config secret put`（新建预览自动继承）+ `wrangler preview secret put --name dev`（补设已存在的预览，Base 配置不回溯）；勿用控制台「Runtime variables and secrets」配预览凭据（部署级设置，下次构建即丢失）

## 项目架构

（首屏的时钟/搜索/常用站点已内联进 views/Home.vue）

调用链分层：视图 → composables → Pinia stores → `src/api/` 封装 → Worker（`worker/index.js` 认证门 + 显式路由表，处理函数在 `worker/routes/`）。前端不直接 fetch，一律走 `src/api/` 封装（自动附带 Basic 认证头）；例外：登录接口由 auth store 直连 fetch（需避开 401 跳转逻辑）、settings store 无 composable 封装由视图直接引用。

## 核心设计

- **单页面应用**: 主页面 Home.vue 同时具备浏览和管理功能，第一屏（大字时钟 + 日期/农历/周数、搜索框含引擎下拉与 Alt+K 键帽、手动固定的常用站点快捷卡片、滚动提示）占满视口高度、第二屏书签库最小视口高度
- **常用站点固定**: 首屏快捷卡片展示手动固定的书签（`bookmarks.is_pinned` 0/1，按 `sort_order` 排序，上限 10 个、宽屏一行 5 个最多两行）；右键书签卡片「固定到首屏/取消固定」，上限校验在服务端（转固定超限返回 400）；`is_pinned` 缺省不修改（编辑书签保留固定状态），创建与批量导入默认未固定；一个都没固定时显示引导提示
- **右键菜单操作**: 分类（分类 pill）和书签（书签卡片）的编辑、删除等操作通过右键菜单触发
- **设置面板**: 顶栏齿轮打开，集中网站名称、头像（前端压缩 128×128）、导入导出、退出登录
- **站点设置持久化**: 存于 D1 `settings` 表（KV），经 `GET/PUT /api/settings` 读写；字段空字符串表示恢复默认，缺省表示不修改；服务端按键白名单（site_name / avatar）校验
- **主题**: 仅浅色主题（Tabular Minimalist：Slate 中性色 + 皇家蓝 `#2563EB`，扁平无阴影、紧凑圆角），无深色模式；设计参考 stitch_1。组件样式禁止硬编码颜色，一律引用 `src/styles/variables.css` 的 token
- **站点图标代理**: `/api/favicon/:domain` 为免认证的图片代理（认证门放行；并发探测目标站首页 HTML 图标声明（只读前 256KB）、favicon.ico、favicon.im、DuckDuckGo、Google s2，魔数校验 + Cache API 缓存 7 天，全失败负面缓存 10 分钟）。书签 `icon_url` 为空时前端经 `useFavicon` 组合式函数自动拼该代理地址渲染，加载失败回退「标题首字头像」
- **导入导出**: 在设置面板中进行，支持浏览器书签 HTML 批量导入（`POST /api/bookmarks/batch`，上限 500 条、批内与库内双重去重）与 JSON 导出
- **Schema 自动初始化**: worker 首次 API 请求探测关键表（favicon 路由除外），缺失时幂等执行根目录 `schema.sql`（经 wrangler `[[rules]]` Text 以文本 import，单一数据源，勿在 worker 内复制 SQL）；`wrangler d1 execute` 手动建表仅作备用
- **URL 安全校验**: 书签 URL 仅允许 http/https 协议（后端强制校验，逻辑在 `worker/utils/validate.js`；前端手动表单提交前经 `src/utils/url.js` 的 `isAllowedUrl` 拦截，导入解析器过滤非 http/https 链接）
- **预设数据**: 分类支持预设的 Remix Icon 图标（`src/constants/categoryIcons.js`）和 10 种常用颜色
- **Basic Auth 认证**: 密码存于 `.dev.vars`（本地）与 Workers Secret（线上），未配置时需认证 API 返回 500 `NOT_CONFIGURED`（登录接口同样 500，favicon 代理不受影响）；token 为 Basic 凭据 Base64 存储——登录页勾选「记住此设备」存 localStorage（30 天，`REMEMBER_DURATION_DAYS`），不勾选存 sessionStorage（关浏览器失效，后端按 `LOGIN_DURATION_DAYS` 默认 7 天兜底）；过期时间仅由前端存储控制，服务端不校验 token 过期（凭据在修改密码前始终有效）
- **字体/图标本地化**: 正文字体（Inter + JetBrains Mono）子集本地化于 `src/assets/fonts/`（`scripts/generate-fonts.mjs` 生成）；图标使用 remixicon npm 包（Apache 2.0），全量字体经 Vite 本地打包，无外部 CDN。新增图标直接写 `ri-xxx-line` class（对照 https://remixicon.com/），无需重跑脚本
- **快捷键支持**: Alt+K 搜索、Alt+N 添加书签、Alt+Shift+N 添加分类、Escape 关闭（Ctrl+N / Ctrl+Shift+N 是浏览器保留快捷键，网页无法拦截，故用 Alt 组合键；Alt+K 曾为 Ctrl+K，因与输入法/扩展冲突改为 Alt 系）
- **书签栏快捷添加**: 「快捷操作」弹窗（原键盘快捷键弹窗）提供可拖拽的 bookmarklet 按钮（`src/utils/bookmarklet.js` 生成，嵌入当前站点 origin）；在任意网页点击书签栏按钮即弹窗打开 `/quick-add`（`views/QuickAdd.vue` 预填 url/title/desc，复用 BookmarkForm），登录回跳经 `src/utils/redirect.js` 的 `safeRedirectPath` 防开放重定向

## 测试约定

- vitest 默认 node 环境；需要 DOM 的测试文件在顶部加注释 `// @vitest-environment happy-dom`
- 例外：`src/utils/importBookmarks.test.js` 用 jsdom（happy-dom 会错误嵌套 DL，导致书签 HTML 解析为空）
- 测试文件与被测代码同目录（`worker/**/*.test.js`、`src/**/*.test.js`）

## 环境变量

- `ADMIN_PASSWORD`: 管理员密码（**必填**；本地放 `.dev.vars`，线上用 `wrangler secret put` 配置，切勿写入 wrangler.toml）
- 其余可选变量（`ADMIN_USERNAME`、`LOGIN_DURATION_DAYS`、`REMEMBER_DURATION_DAYS` 等）见 `wrangler.toml` [vars]
