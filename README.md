# NavManager

自用的网址导航管理平台，替代浏览器书签功能。

## 功能特性

- 📁 **分类管理** - 支持 Emoji 图标和颜色标识，右键编辑/删除
- 🔗 **书签管理** - 自动获取网站图标，支持一键导入浏览器书签（HTML）
- 🔍 **搜索功能** - 站内即时搜索 + 多引擎网页搜索（Google/GitHub/百度等）
- 🕐 **导航首页** - 时钟/农历/分类卡片，书签快速到达
- 🔒 **Basic Auth** - 简单的密码保护
- 📤 **导入导出** - 支持浏览器书签 HTML 导入与 JSON 导出
- ⌨️ **快捷键** - 提升操作效率
- 📱 **响应式设计** - 支持移动端访问

## 技术栈

- **前端**: Vue 3 + Vue Router + Pinia
- **后端**: Cloudflare Pages Functions
- **数据库**: Cloudflare D1 (SQLite)
- **CSS**: 纯 CSS（无框架依赖）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 聚焦搜索框 |
| `Alt + N` | 添加书签 |
| `Alt + Shift + N` | 添加分类 |
| `Escape` | 关闭模态框/菜单 |

> 说明：Ctrl+N / Ctrl+Shift+N 是浏览器保留快捷键（新建窗口），网页无法拦截，故使用 Alt 组合键。

## 本地开发

### 前置要求

- Node.js 18+
- pnpm
- Wrangler CLI

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd nav-manager

# 安装依赖
pnpm install

# 登录 Cloudflare
wrangler login
```

### 配置

1. 创建 D1 数据库：
```bash
wrangler d1 create nav-db
```

2. 更新 `wrangler.toml` 中的数据库 ID

3. 执行数据库 Schema（可重复执行，默认分类为幂等插入）：
```bash
wrangler d1 execute nav-db --file=schema.sql
```

4. 配置管理员密码（切勿提交到仓库）：
   - 本地开发：在 `.dev.vars` 中设置（已被 gitignore）：
     ```
     ADMIN_USERNAME=admin
     ADMIN_PASSWORD=你的密码
     ```
   - **未配置密码时，服务端会拒绝所有访问**

### 开发

```bash
# 同时启动前端 (5173) 与本地 API (8788)
pnpm dev:full

# 或分别启动
pnpm dev      # 仅前端
pnpm dev:api  # 仅 API（绑定与配置读取自 wrangler.toml / .dev.vars）
```

访问 http://localhost:5173

### 构建

```bash
pnpm build
```

## 部署到 Cloudflare Pages

### 方式一：命令行部署

```bash
# 构建项目
pnpm build

# 部署到 Cloudflare Pages
pnpm deploy

# 配置线上密码（secret，不会出现在代码与日志中）
wrangler pages secret put ADMIN_PASSWORD
wrangler pages secret put ADMIN_USERNAME   # 可选，默认 admin
```

### 方式二：GitHub 集成

1. 在 Cloudflare Dashboard 中创建 Pages 项目
2. 连接 GitHub 仓库
3. 配置构建设置：
   - 构建命令: `pnpm build`
   - 输出目录: `dist`
4. 添加 D1 数据库绑定
5. 在环境变量中配置密码（使用 **Secret** 类型，不要用明文变量）

### 环境变量

| 变量名 | 说明 | 配置方式 |
|--------|------|----------|
| `ADMIN_USERNAME` | 管理员用户名 | Secret 或 `.dev.vars`（默认 `admin`） |
| `ADMIN_PASSWORD` | 管理员密码 | Secret 或 `.dev.vars`（**必填，无默认值**） |
| `LOGIN_DURATION_DAYS` | 登录保持天数 | `wrangler.toml` [vars]（默认 `7`） |

> ⚠️ 密码属于凭据，不要写入 `wrangler.toml`（该文件会被 git 跟踪并随部署生效）。

### 数据库绑定

在 Cloudflare Pages 设置中添加 D1 数据库绑定：

- 变量名: `DB`
- 数据库: `nav-db`

## 使用说明

### 访问与登录

- 打开部署的 URL，未登录时自动跳转登录页
- 所有数据（含浏览）均需登录后访问
- 登录状态默认保持 7 天

### 导入浏览器书签

1. 在浏览器中导出书签为 HTML 文件
2. 进入书签资料库，点击「导入书签」选择该文件
3. 文件夹自动转为分类（同名合并），书签批量导入

### 分类管理

- 点击分类卡片/分类 pills 筛选书签
- 右键分类 pill 可以编辑或删除（删除后书签变为未分类，不会丢失）

### 书签管理

- 点击书签卡片在新标签页打开
- 右键书签可以编辑、复制链接或删除
- 添加书签时输入 URL 自动获取网站图标

## 项目结构

```
nav-manager/
├── src/
│   ├── components/        # Vue 组件
│   │   ├── layout/       # 布局组件
│   │   ├── bookmark/     # 书签组件
│   │   ├── category/     # 分类组件
│   │   ├── hero/         # 首屏组件（时钟/搜索/分类卡片）
│   │   └── common/       # 通用组件
│   ├── composables/      # 组合式函数
│   ├── stores/           # Pinia 状态
│   ├── api/              # API 封装
│   ├── utils/            # 工具函数（书签导入解析等）
│   ├── styles/           # CSS 样式
│   └── views/            # 页面视图
├── functions/            # Cloudflare Functions
│   └── api/              # API 端点
├── schema.sql            # 数据库 Schema
└── wrangler.toml         # Cloudflare 配置
```

## 安全说明

- token 为 Basic Auth 凭据的 Base64 编码，存储于 localStorage；请勿在不受信任的设备上登录
- 登录接口对失败尝试做了简易延迟防护；公网部署建议在 Cloudflare 侧再配置 WAF 速率限制
- 页面已设置 `robots noindex`，避免个人书签站被搜索引擎收录

## API 文档

详见 [API.md](./API.md)

## 许可证

MIT License，详见 [LICENSE](./LICENSE)
