# NavBase

自用的网址导航管理平台，替代浏览器书签功能。

## 功能特性

- 📁 **分类管理** - 支持 Remix Icon 图标和颜色标识，右键编辑/删除
- 🔗 **书签管理** - 自动获取网站图标，支持一键导入浏览器书签（HTML）
- 🔍 **搜索功能** - 站内即时搜索 + 多引擎网页搜索（百度/Google/GitHub）
- 🕐 **导航首页** - 大字时钟/农历、多引擎搜索、常用站点快捷卡片
- ⚙️ **站点设置** - 自定义网站名称与头像
- 🎨 **扁平浅色设计** - Slate 中性色 + 皇家蓝点缀，无深色模式
- 🔒 **Basic Auth** - 简单的密码保护
- 📤 **导入导出** - 支持浏览器书签 HTML 导入与 JSON 导出
- ⌨️ **快捷键** - 提升操作效率
- 📱 **响应式设计** - 支持移动端访问

## 技术栈

- **前端**: Vue 3 + Vue Router + Pinia
- **后端**: Cloudflare Pages Functions
- **数据库**: Cloudflare D1 (SQLite)
- **CSS**: 纯 CSS（无框架依赖）
- **测试**: Vitest

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

- Node.js 22+（Vite 8 与 Wrangler 4 的最低要求）
- pnpm
- Wrangler CLI（无需全局安装：已随项目 devDependencies 安装，用 `pnpm exec wrangler` 调用）

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd NavBase

# 安装依赖
pnpm install

# 登录 Cloudflare（wrangler 已随项目依赖安装，无需全局安装）
pnpm exec wrangler login
```

### 配置

1. 创建 D1 数据库：
   ```bash
   pnpm exec wrangler d1 create navbase-db
   ```

2. 更新 `wrangler.toml` 中的数据库 ID

3. 执行数据库 Schema（可重复执行，默认分类为幂等插入）。**本地库与线上库是两个独立的库，需分别执行**，否则会报 `no such table`：
   ```bash
   # 本地开发库（不带 --remote）
   pnpm exec wrangler d1 execute navbase-db --file=schema.sql

   # 线上库（部署前执行一次）
   pnpm exec wrangler d1 execute navbase-db --file=schema.sql --remote
   ```

4. 配置管理员密码（切勿提交到仓库）：
   - 本地开发：在 `.dev.vars` 中设置（已被 gitignore）：
     ```
     ADMIN_USERNAME=admin
     ADMIN_PASSWORD=你的密码
     ```
   - **未配置密码时，所有 API 请求会被拒绝（返回 500）**

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

### 测试

```bash
pnpm test                                    # 全量运行
pnpm test:watch                              # 监听模式
pnpm test src/composables/useLunar.test.js   # 运行单个测试文件
```

## 部署到 Cloudflare Pages

### 方式一：命令行部署

```bash
# 构建项目
pnpm build

# 首次部署前初始化线上数据库
pnpm exec wrangler d1 execute navbase-db --file=schema.sql --remote

# 部署到 Cloudflare Pages
pnpm deploy

# 配置线上密码（secret，不会出现在代码与日志中）
pnpm exec wrangler pages secret put ADMIN_PASSWORD
pnpm exec wrangler pages secret put ADMIN_USERNAME   # 可选，默认 admin
```

### 方式二：GitHub 集成

1. 在 Cloudflare Dashboard 中创建 Pages 项目
2. 连接 GitHub 仓库
3. 配置构建设置：
   - 构建命令: `pnpm build`
   - 输出目录: `dist`
4. 添加 D1 数据库绑定
5. 初始化线上数据库 Schema：
   ```bash
   pnpm exec wrangler d1 execute navbase-db --file=schema.sql --remote
   ```
6. 在环境变量中配置密码（使用 **Secret** 类型，不要用明文变量）

### 环境变量

| 变量名 | 说明 | 配置方式 |
|--------|------|----------|
| `ADMIN_USERNAME` | 管理员用户名 | Secret 或 `.dev.vars`（默认 `admin`） |
| `ADMIN_PASSWORD` | 管理员密码 | Secret 或 `.dev.vars`（**必填，无默认值**） |
| `LOGIN_DURATION_DAYS` | 登录保持天数 | `wrangler.toml` [vars]（默认 `7`） |
| `REMEMBER_DURATION_DAYS` | 勾选「记住此设备」时的登录保持天数 | `wrangler.toml` [vars]（默认 `30`） |

> ⚠️ 密码属于凭据，不要写入 `wrangler.toml`（该文件会被 git 跟踪并随部署生效）。

### 数据库绑定

在 Cloudflare Pages 设置中添加 D1 数据库绑定：

- 变量名: `DB`
- 数据库: `navbase-db`

## 使用说明

### 访问与登录

- 打开部署的 URL，未登录时自动跳转登录页
- 书签与设置数据均需登录后访问（站点图标代理 `/api/favicon/*` 为公开图片接口，免认证）
- 勾选「记住此设备」登录状态保持 30 天，不勾选则关闭浏览器后失效

### 导入浏览器书签

1. 在浏览器中导出书签为 HTML 文件
2. 打开设置面板（顶栏齿轮），点击「导入书签」选择该文件
3. 文件夹自动转为分类（同名合并），书签批量导入

### 站点设置

- 顶栏齿轮打开设置面板，可自定义网站名称与头像（png/jpeg/webp，自动压缩为 128×128）
- 导入导出与退出登录也在设置面板中

### 分类管理

- 点击分类 pill 筛选书签
- 右键分类 pill 可以编辑或删除（删除后书签变为未分类，不会丢失）

### 书签管理

- 点击书签卡片在新标签页打开
- 右键书签可以编辑、复制链接或删除
- 添加书签时输入 URL 自动获取网站图标

## 项目结构

```
NavBase/
├── src/
│   ├── components/        # Vue 组件
│   │   ├── layout/       # 布局组件
│   │   ├── bookmark/     # 书签组件
│   │   ├── category/     # 分类组件
│   │   └── common/       # 通用组件
│   ├── composables/      # 组合式函数
│   ├── stores/           # Pinia 状态
│   ├── api/              # API 封装
│   ├── utils/            # 工具函数（书签导入解析等）
│   ├── styles/           # CSS 样式
│   └── views/            # 页面视图
├── functions/            # Cloudflare Functions
│   ├── api/              # API 端点
│   └── utils/            # 共享校验工具（URL 协议白名单等）
├── scripts/              # 构建与辅助脚本（正文字体子集生成、API 冒烟测试）
├── migrations/           # 数据库迁移 SQL
├── schema.sql            # 数据库 Schema
└── wrangler.toml         # Cloudflare 配置
```

## 安全说明

- token 为 Basic Auth 凭据的 Base64 编码，存储于 localStorage（勾选记住此设备）或 sessionStorage；请勿在不受信任的设备上登录
- 登录接口对失败尝试做了简易延迟防护；公网部署建议在 Cloudflare 侧再配置 WAF 速率限制
- 页面已设置 `robots noindex`，避免个人书签站被搜索引擎收录

## API 文档

详见 [API.md](./API.md)

## 许可证

MIT License，详见 [LICENSE](./LICENSE)
