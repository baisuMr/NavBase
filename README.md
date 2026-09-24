# NavBase

自用的网址导航管理平台，替代浏览器书签功能。前端 SPA 与 API 统一运行在 [Cloudflare Workers](https://workers.cloudflare.com/) 上，数据存于 [Cloudflare D1](https://developers.cloudflare.com/d1/)——**零成本部署**（免费计划额度远超个人书签站用量）、无服务器运维、部署即接入全球边缘网络。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/baisuMr/NavBase)

## 功能特性

- 📁 **分类管理** - 拖拽排序，Remix Icon 图标与颜色标识，右键编辑/删除
- 🔗 **书签管理** - 自动获取网站图标，一键导入浏览器书签（HTML）
- 🔍 **搜索功能** - 站内即时搜索 + 多引擎网页搜索（Tab 切换引擎）
- 🕐 **导航首页** - 大字时钟/农历/周数、多引擎搜索、常用站点快捷卡片
- ⚙️ **站点设置** - 自定义网站名称与头像，书签导入导出
- 🎨 **扁平浅色设计** - Slate 中性色 + 皇家蓝点缀，无深色模式
- 🔒 **Basic Auth** - 单用户密码保护
- ⌨️ **快捷键** - Alt+K 搜索、Alt+N 添加书签、Alt+Shift+N 添加分类
- ⭐ **快捷添加** - 书签栏按钮一键收藏任意网页（自动抓取网址/标题/描述）
- 📱 **响应式设计** - 支持移动端访问

## 技术栈

- **前端**: Vue 3 + Vue Router + Pinia（纯 CSS，无 UI 框架）
- **后端**: Cloudflare Workers（Static Assets + Worker 脚本）
- **数据库**: Cloudflare D1 (SQLite)
- **图标/字体**: Remix Icon 与 Inter / JetBrains Mono 子集本地打包，无外部 CDN
- **测试**: Vitest

---

## 一键部署

部署目标为 **Cloudflare Workers**：静态资源由 Workers Static Assets 托管，API 由同一个 Worker 处理，数据存 D1。全程无需本地环境，**Cloudflare 免费计划即可运行**（Workers 免费 10 万请求/天 + D1 免费 5GB 存储，个人书签站用量远低于额度，零成本）。

### 部署步骤

1. 准备一个 [Cloudflare 账号](https://dash.cloudflare.com/)（免费计划即可）并点击上方 **Deploy to Cloudflare** 按钮
2. 授权 Cloudflare 访问你的 GitHub 账号
3. 在「设置您的应用程序」页按下表填写：

   | 页面字段 | 怎么填 |
   |--------|--------|
   | Git 帐户 | 选择你的 GitHub 账号。向导会在其下创建本仓库的 Git 存储库并连接应用，对生产分支的每次推送都会自动部署 |
   | 创建专用 Git 存储库 | 可按需勾选 |
   | 项目名称 | 默认 `navbase`，可自定义；这是 Worker 名，决定访问地址 |
   | Select D1 数据库 | 保持默认 `navbase-db`（向导自动创建并绑定） |
   | ADMIN_USERNAME / ADMIN_PASSWORD | **可以不填**：⚠️ 这里填的值只会成为**构建环境变量**，**不会**成为 Worker 运行时 Secret，登录凭据以第 5 步手动补配的为准 |
   | LOGIN_DURATION_DAYS / REMEMBER_DURATION_DAYS | 保持默认 `7` / `30`；部署后可在仓库 `wrangler.toml` [vars] 中修改登录时效，推送后自动生效 |
   | 构建命令 | `pnpm run build` |
   | 部署命令 | 默认 `pnpm run deploy`；也可填 `npx wrangler deploy`（构建命令已构建过，可省一次重复构建） |
   | 预览命令 | 默认即可 |
   | 启用预览构建 | 建议开启（Pull Request 自动生成预览） |
   | Protect with Cloudflare Access | 默认关闭，本项目不需要 |
   | 高级设置 → 路径 | `/` |
   | 高级设置 → API 令牌 | 保持默认；若出现黄条提示缺少 `ssl_and_certificates_write`、`email_routing_*` 等权限可忽略——它们对应本项目用不到的产品，不影响部署 |
   | 变量名称 / 变量值 | 添加更多**构建**变量的入口（「加密」表示存为构建 Secret），本项目用不到；这里添加的变量同样**不会**进入线上运行时 |

4. 点击右下角**部署**，等待构建完成
5. **补配 Worker Secret（必做，否则无法登录）**：打开 Worker **Settings → Variables and Secrets**，添加 **Secret** 类型条目（类型务必选 Secret）：
   - `ADMIN_PASSWORD`：管理员密码（**必填**）
   - `ADMIN_USERNAME`：管理员用户名（可选，缺省为 `admin`）
6. 访问 `https://<项目名>.<账号子域>.workers.dev`，用第 5 步配置的账号密码登录即可使用

### 一键部署自动完成了什么

- 将本仓库克隆到你的 GitHub 账号（后续可自由修改）
- 创建 D1 数据库并绑定到 Worker（`database_id` 自动回写进你仓库的 `wrangler.toml`）
- **首次请求自动建表**（worker 检测到空库时幂等执行 `schema.sql`，无需手动初始化）
- 配置 Workers Builds：之后 `git push` 到 main 分支即自动构建重新部署，Pull Request 自动生成预览 URL
- ⚠️ **不包括** `ADMIN_USERNAME` / `ADMIN_PASSWORD`：向导里填写的值只作为构建环境变量，需按上文第 5 步手动补配为 Worker Secret

### 日常更新

约定：**`main` 分支即线上**（Workers Builds 仅监听 `main` 的推送），日常开发在 **`dev` 分支**进行：

```bash
# 日常开发：随便提交推送，不会触发部署
git checkout dev
git pull
git commit ...
git push

# 功能完成：合并进 main 才上线（唯一触发部署的动作）
git checkout main
git merge dev
git push
```

- 未完成功能想在线验收：推送到非生产分支会自动构建 Preview，稳定 URL 为 `https://<分支名>-<Worker 名>.<账号子域>.workers.dev`，开 PR 还会把 URL 评论到 PR，满意后再合并
- 预览构建使用 `wrangler.toml` 的 `[previews]` 独立配置（变量与绑定不复用生产设置）：自己部署时请把 `previews.d1_databases.database_id` 换成你自己的预览库（`wrangler d1 create <名称>` 获取），并用 `wrangler preview secret put ADMIN_PASSWORD` 配置预览登录密码
- 紧急修复线上问题：可在 `main` 直接修复并推送上线，之后执行 `git checkout dev && git merge main` 把修复同步回 `dev`

### 绑定自定义域名（可选）

1. 将域名的 DNS 托管到 Cloudflare
2. Cloudflare 控制台 → Workers & Pages → 你的 Worker → **Settings → Domains & Routes → Add → Custom Domain**，填入域名
3. 绑定后站点图标代理的边缘缓存随之启用（`*.workers.dev` 下不缓存，仅略慢）

### 环境变量

| 变量名 | 说明 | 配置方式 |
|--------|------|----------|
| `ADMIN_USERNAME` | 管理员用户名 | Secret（部署后在 Settings → Variables and Secrets 手动添加，默认 `admin`） |
| `ADMIN_PASSWORD` | 管理员密码 | Secret（同上，**必填**） |
| `LOGIN_DURATION_DAYS` | 登录保持天数 | `wrangler.toml` [vars]（默认 `7`） |
| `REMEMBER_DURATION_DAYS` | 勾选「记住此设备」时的登录保持天数 | `wrangler.toml` [vars]（默认 `30`） |

> ⚠️ 密码属于凭据，不要写入 `wrangler.toml`（该文件会被 git 跟踪并随部署生效）。部署向导里填写的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 只会保存为构建环境变量，不会成为 Worker Secret，必须在控制台手动添加。

### 常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 所有 API 返回 500 `NOT_CONFIGURED` | 未配置 `ADMIN_PASSWORD` Secret：部署向导里填的值不会自动生效，前往 Worker **Settings → Variables and Secrets** 添加 `ADMIN_PASSWORD`（类型选 Secret）后重试 |
| 部署设置页黄条提示 API 令牌缺少权限 | 缺少的是 `ssl_and_certificates_write`、`email_routing_*` 等本项目用不到的权限，直接点「部署」即可 |
| 所有 API 返回 500 `DB_INIT_FAILED` | D1 初始化失败：检查 Worker 的 **Settings → Bindings** 中 D1 绑定是否存在，修复后重试（worker 会自动重试建表） |
| 登录提示「用户名或密码错误」 | 核对 Secret 中的凭据；修改后需重新部署或等待缓存刷新 |
| 线上 favicon 每次都重新探测 | `*.workers.dev` 域名下 Cache API 不生效；绑定自定义域名后恢复 7 天缓存 |

---

## 本地开发

需要 Node.js 22.12+（或 24 / 26）与 pnpm 12。

```bash
git clone https://github.com/baisuMr/NavBase.git
cd NavBase
pnpm install
```

复制 `.dev.vars.example` 为 `.dev.vars`，填入本地管理员密码（已被 gitignore，切勿提交）。

```bash
pnpm build      # 生成 dist/（wrangler dev 需托管静态资源，首次必跑）
pnpm dev:full   # 同时启动前端 (5173) 与本地 API (8788)
```

访问 http://localhost:5173。本地 D1 位于 `.wrangler/state`，首次 API 请求自动建表，无需手动执行 `schema.sql`。

### 测试

```bash
pnpm test                                    # 全量运行
pnpm test:watch                              # 监听模式
pnpm test src/composables/useLunar.test.js   # 运行单个测试文件
bash scripts/test-api.sh                     # 本地 API 冒烟（需本地 API 在跑）
```

---

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
├── worker/               # Cloudflare Worker
│   ├── index.js          # 入口：认证门 + 路由表 + schema 惰性初始化 + ASSETS 兜底
│   ├── auth.js           # Basic Auth 认证门
│   ├── schema-init.js    # D1 schema 自动初始化（空库幂等建表）
│   ├── routes/           # API 端点处理函数
│   └── utils/            # 共享校验工具与测试 D1 mock
├── scripts/              # 构建与辅助脚本（正文字体子集生成、API 冒烟测试）
├── migrations/           # 数据库迁移 SQL
├── schema.sql            # 数据库 Schema（幂等，worker 首次请求自动执行）
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
