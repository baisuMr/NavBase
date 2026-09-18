# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

NavManager 是一个自用的网址导航管理平台，用于替代浏览器书签功能。采用 Vue 3 + Cloudflare Pages + D1 数据库的技术栈。

## 技术栈

- **前端**: Vue 3 + JavaScript（不使用 TypeScript）
- **路由**: Vue Router 4.x
- **状态管理**: Pinia 2.x
- **构建工具**: Vite 5.x
- **CSS**: 纯 CSS（不使用 Tailwind 或其他 CSS 框架）
- **后端**: Cloudflare Pages Functions
- **数据库**: Cloudflare D1 (SQLite)

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动完整开发环境（前端 + API）
pnpm dev:full

# 仅启动前端开发服务器
pnpm dev

# 仅启动 API开发服务器
pnpm dev:api

# 同时启动前端与 API（推荐）
pnpm dev:full

# 构建生产版本
pnpm build

# 运行单元测试（vitest，覆盖 middleware 校验/协议白名单/书签解析/农历等核心逻辑）
pnpm test

# 监听模式运行测试
pnpm test:watch

# 预览构建结果
pnpm preview

# 部署到 Cloudflare Pages
pnpm deploy

# D1 数据库操作
wrangler d1 execute nav-db --file=schema.sql  # 执行 SQL 文件
wrangler d1 execute nav-db --command="SELECT * FROM bookmarks"  # 执行单条 SQL
```

## 项目架构

```
src/
├── components/          # Vue 组件
│   ├── layout/         # 布局组件（AppHeader）
│   ├── bookmark/       # 书签相关组件（BookmarkExplorer, BookmarkCard, BookmarkForm）
│   ├── category/       # 分类相关组件
│   ├── hero/           # 首屏组件（HeroClock, HeroSearch, HeroCategoryCards）
│   └── common/         # 通用组件（ContextMenu, Modal, ColorPicker, EmojiPicker）
├── composables/        # 组合式函数（业务逻辑复用）
├── stores/             # Pinia 状态管理
├── api/                # API 调用封装（统一带认证头）
├── styles/             # CSS 样式文件
├── utils/              # 工具函数（浏览器书签 HTML 解析等）
└── views/              # 页面视图

functions/              # Cloudflare Functions（API 后端）
├── api/
│   ├── bookmarks/      # 书签 CRUD + 批量导入 API
│   ├── categories/     # 分类 CRUD API
│   ├── favicon/        # 获取网站图标 API
│   └── auth/           # 认证 API
└── _middleware.js       # 中间件（Basic Auth 认证，未配置密码时拒绝一切访问）
```

## 核心设计

- **单页面应用**: 主页面 Home.vue 同时具备浏览和管理功能
- **右键菜单操作**: 分类（分类 pill）和书签（书签卡片）的编辑、删除等操作通过右键菜单触发
- **自动获取图标**: 书签的 favicon 通过 `/api/favicon/:domain` 获取（favicon.im、DuckDuckGo等），前端必须走带认证头的 api 封装
- **导入导出**: 支持浏览器书签 HTML 批量导入（`POST /api/bookmarks/batch`，上限 500 条）与 JSON 导出
- **URL 安全校验**: 书签 URL 仅允许 http/https 协议（前后端共同校验）
- **预设数据**: 分类支持预设的 Emoji 图标和 10 种常用颜色
- **Basic Auth 认证**: 密码存于 `.dev.vars`（本地）与 Pages Secret（线上），未配置时服务端拒绝一切访问
- **快捷键支持**: Ctrl+K 搜索、Alt+N 添加书签、Alt+Shift+N 添加分类、Escape 关闭

## 数据库表结构

- `categories`: id, name, icon (emoji), color, sort_order, created_at, updated_at
- `bookmarks`: id, title, url, description, category_id, icon_url, sort_order, created_at, updated_at

## 配置文件

- `wrangler.toml`: Cloudflare 配置（D1 绑定、环境变量）
- `vite.config.js`: Vite 构建配置
- `schema.sql`: 数据库初始化脚本

## 环境变量

- `ADMIN_PASSWORD`: 管理员密码（**必填**；本地放 `.dev.vars`，线上用 `wrangler pages secret put` 配置，切勿写入 wrangler.toml）
- `ADMIN_USERNAME`: 管理员用户名（可选，默认 `admin`）
- `LOGIN_DURATION_DAYS`: 登录保持天数（wrangler.toml [vars]，默认 `7`）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 聚焦搜索框 |
| `Alt + N` | 添加书签 |
| `Alt + Shift + N` | 添加分类 |
| `Escape` | 关闭模态框/菜单 |
