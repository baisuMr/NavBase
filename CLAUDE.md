# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

NavBase 是一个自用的网址导航管理平台，用于替代浏览器书签功能。前端 SPA 与 API 同部署于 Cloudflare Pages，数据存 D1，Basic Auth 单用户认证。

## 技术栈与约束

- **前端**: Vue 3 + JavaScript（不使用 TypeScript）
- **路由**: Vue Router；**状态管理**: Pinia；**构建**: Vite
- **CSS**: 纯 CSS（不使用 Tailwind 等 CSS 框架）
- **后端**: Cloudflare Pages Functions；**数据库**: Cloudflare D1 (SQLite)
- **测试**: Vitest
- **农历**: lunar-javascript 体积大，经 `src/composables/useLunar.js` 动态 import 拆为独立 chunk，勿改回静态引入

## 常用命令

```bash
# 安装依赖
pnpm install

# 完整开发环境（前端 5173 + API 8788；vite 已配置 /api 代理到 8788）
pnpm dev:full

# 仅启动前端开发服务器
pnpm dev

# 仅启动 API 开发服务器
pnpm dev:api

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview

# 部署到 Cloudflare Pages
pnpm deploy

# 测试（vitest）
pnpm test                                        # 全量运行
pnpm test:watch                                  # 监听模式
pnpm test src/composables/useLunar.test.js       # 运行单个测试文件（pnpm 直接透传参数，无需 --）

# 正文字体子集再生成（需可访问 fonts.googleapis.com）
node scripts/generate-fonts.mjs

# D1 数据库操作（默认操作本地库；操作线上库追加 --remote）
pnpm exec wrangler d1 execute navbase-db --file=schema.sql  # 执行 SQL 文件（幂等，可重复执行）
pnpm exec wrangler d1 execute navbase-db --command="SELECT * FROM bookmarks"  # 执行单条 SQL
```

## 项目架构

```
src/
├── components/          # Vue 组件
│   ├── layout/         # 布局组件（AppHeader）
│   ├── bookmark/       # 书签相关组件（BookmarkExplorer, BookmarkCard, BookmarkForm）
│   ├── category/       # 分类相关组件（CategoryForm）
│   └── common/         # 通用组件（ContextMenu, Modal, SettingsPanel, ShortcutHelp, ColorPicker, IconPicker…）
├── composables/        # 组合式函数：stores 的薄封装 + UI 逻辑（快捷键/右键菜单/搜索/农历）
├── stores/             # Pinia 状态管理（auth / bookmarks / categories / settings）
├── api/                # API 调用封装（统一带认证头，401 时清状态并跳登录页）
├── styles/             # CSS 样式文件
├── utils/              # 工具函数（浏览器书签 HTML 解析等）
└── views/              # 页面视图（Home 双屏主视图、Login）

functions/              # Cloudflare Functions（API 后端）
├── api/
│   ├── bookmarks/      # 书签 CRUD + 批量导入 API
│   ├── categories/     # 分类 CRUD API
│   ├── settings/       # 站点设置 GET/PUT（网站名称、头像）
│   ├── favicon/        # 获取网站图标 API
│   └── auth/           # 认证 API
├── utils/              # 共享校验工具（validate.js，前后端共同的 URL/字段约束）
└── _middleware.js       # 中间件（Basic Auth 认证，未配置密码时拒绝所有 API 请求返回 500）

scripts/
└── generate-fonts.mjs         # 正文字体子集本地化生成脚本
```

（首屏的时钟/搜索/常用站点已内联进 views/Home.vue）

调用链分层：视图 → composables → Pinia stores → `src/api/` 封装 → Pages Functions。前端不直接 fetch，一律走 `src/api/` 封装（自动附带 Basic 认证头）；例外：登录接口由 auth store 直连 fetch（需避开 401 跳转逻辑）、settings store 无 composable 封装由视图直接引用。

## 核心设计

- **单页面应用**: 主页面 Home.vue 同时具备浏览和管理功能，第一屏（大字时钟 + 日期/农历/周数、搜索框含引擎下拉与 Ctrl+K 键帽、排序前 5 书签的常用站点快捷卡片、滚动提示）占满视口高度、第二屏书签库最小视口高度
- **右键菜单操作**: 分类（分类 pill）和书签（书签卡片）的编辑、删除等操作通过右键菜单触发
- **设置面板**: 顶栏齿轮打开，集中网站名称、头像（前端压缩 128×128）、导入导出、退出登录
- **站点设置持久化**: 存于 D1 `settings` 表（KV），经 `GET/PUT /api/settings` 读写；字段空字符串表示恢复默认，缺省表示不修改；服务端按键白名单（site_name / avatar）校验
- **主题**: 仅浅色主题（Tabular Minimalist：Slate 中性色 + 皇家蓝 `#2563EB`，扁平无阴影、紧凑圆角），无深色模式；设计参考 stitch_1。组件样式禁止硬编码颜色，一律引用 `src/styles/variables.css` 的 token
- **站点图标代理**: `/api/favicon/:domain` 为免认证的图片代理（中间件放行；并发探测目标站 favicon.ico、favicon.im、DuckDuckGo、Google s2，魔数校验 + Cache API 缓存 7 天，全失败负面缓存 10 分钟）。书签 `icon_url` 为空时前端经 `useFavicon` 组合式函数自动拼该代理地址渲染，加载失败回退「标题首字头像」
- **导入导出**: 在设置面板中进行，支持浏览器书签 HTML 批量导入（`POST /api/bookmarks/batch`，上限 500 条、批内与库内双重去重）与 JSON 导出
- **URL 安全校验**: 书签 URL 仅允许 http/https 协议（前后端共同校验，后端逻辑在 `functions/utils/validate.js`）
- **预设数据**: 分类支持预设的 Remix Icon 图标（`src/constants/categoryIcons.js`）和 10 种常用颜色
- **Basic Auth 认证**: 密码存于 `.dev.vars`（本地）与 Pages Secret（线上），未配置时所有 API 请求被拒绝（返回 500）；token 为 Basic 凭据 Base64 存储——登录页勾选「记住此设备」存 localStorage（30 天，`REMEMBER_DURATION_DAYS`），不勾选存 sessionStorage（关浏览器失效，后端按 `LOGIN_DURATION_DAYS` 默认 7 天兜底）；过期时间仅由前端存储控制，服务端不校验 token 过期（凭据在修改密码前始终有效）
- **字体/图标本地化**: 正文字体（Inter + JetBrains Mono）子集本地化于 `src/assets/fonts/`（`scripts/generate-fonts.mjs` 生成）；图标使用 remixicon npm 包（Apache 2.0），全量字体经 Vite 本地打包，无外部 CDN。新增图标直接写 `ri-xxx-line` class（对照 https://remixicon.com/），无需重跑脚本
- **快捷键支持**: Ctrl+K 搜索、Alt+N 添加书签、Alt+Shift+N 添加分类、Escape 关闭

## 测试约定

- vitest 默认 node 环境；需要 DOM 的测试文件在顶部加注释 `// @vitest-environment happy-dom`
- 测试文件与被测代码同目录（`functions/**/*.test.js`、`src/**/*.test.js`）

## 数据库表结构

- `categories`: id, name, icon (ri-* 图标名), color, sort_order, created_at, updated_at
- `bookmarks`: id, title, url, description, category_id, icon_url, sort_order, created_at, updated_at
- `settings`: key (site_name / avatar), value, updated_at

## 配置文件

- `wrangler.toml`: Cloudflare 配置（D1 绑定、环境变量）
- `vite.config.js`: Vite 构建配置（含 `@` 别名与 /api 代理）
- `vitest.config.js`: 测试配置
- `schema.sql`: 数据库初始化脚本

## 环境变量

- `ADMIN_PASSWORD`: 管理员密码（**必填**；本地放 `.dev.vars`，线上用 `wrangler pages secret put` 配置，切勿写入 wrangler.toml）
- `ADMIN_USERNAME`: 管理员用户名（可选，默认 `admin`）
- `LOGIN_DURATION_DAYS`: 登录保持天数（wrangler.toml [vars]，默认 `7`）
- `REMEMBER_DURATION_DAYS`: 勾选「记住此设备」时的登录保持天数（wrangler.toml [vars]，默认 `30`）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 聚焦搜索框 |
| `Alt + N` | 添加书签 |
| `Alt + Shift + N` | 添加分类 |
| `Escape` | 关闭模态框/菜单 |

> Ctrl+N / Ctrl+Shift+N 是浏览器保留快捷键（新建窗口），网页无法拦截，故使用 Alt 组合键。
