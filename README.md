# NavBase

自用的网址导航管理平台，替代浏览器书签功能。**基于 Cloudflare 构建与部署**：前端 SPA 与 API 统一运行在 [Cloudflare Workers](https://workers.cloudflare.com/)（Static Assets + Worker 脚本）上，数据存储于 [Cloudflare D1](https://developers.cloudflare.com/d1/)（SQLite）——无服务器运维，一条命令部署到全球边缘节点。

## 功能特性

- 📁 **分类管理** - 拖拽排序，Remix Icon 图标与颜色标识，右键编辑/删除
- 🔗 **书签管理** - 自动获取网站图标，一键导入浏览器书签（HTML）
- 🔍 **搜索功能** - 站内即时搜索 + 多引擎网页搜索（Tab 切换引擎）
- 🕐 **导航首页** - 大字时钟/农历/周数、多引擎搜索、常用站点快捷卡片
- ⚙️ **站点设置** - 自定义网站名称与头像，书签导入导出
- 🎨 **扁平浅色设计** - Slate 中性色 + 皇家蓝点缀，无深色模式
- 🔒 **Basic Auth** - 单用户密码保护
- 📤 **导入导出** - 浏览器书签 HTML 导入、JSON 备份导出
- ⌨️ **快捷键** - 提升操作效率
- 📱 **响应式设计** - 支持移动端访问

## 技术栈

- **前端**: Vue 3 + Vue Router + Pinia（纯 CSS，无 UI 框架）
- **后端**: Cloudflare Workers（Static Assets + Worker 脚本）
- **数据库**: Cloudflare D1 (SQLite)
- **图标/字体**: Remix Icon 与 Inter / JetBrains Mono 子集本地打包，无外部 CDN
- **测试**: Vitest

---

## 使用教程

### 访问与登录

1. 打开部署地址（如 `https://navbase.workers.dev/` 或你的自定义域名），未登录会自动跳转登录页
2. 输入管理员用户名与密码登录
3. 登录保持时长二选一：
   - 勾选 **「记住此设备」**：保持 30 天（存 localStorage）
   - 不勾选：关闭浏览器即失效（存 sessionStorage）
4. 书签与设置数据均需登录后访问；站点图标代理 `/api/favicon/*` 是唯一的公开接口（只返回网站公开图标）

### 导入浏览器书签（首次上手推荐）

1. 从浏览器书签管理器导出书签 HTML 文件：
   - **Chrome / Edge**：书签管理器 → 右上角 `⋮` → 导出书签
   - **Firefox**：书签 → 管理书签（`Ctrl+Shift+O`）→ 导入和备份 → 导出书签到 HTML
2. 打开设置面板（顶栏齿轮）→ 点击 **「导入书签」** → 选择该文件
3. 导入规则：
   - 书签文件夹自动转为分类（同名合并）
   - 单次上限 500 条；批内与库内按 URL 自动去重，重复项跳过
   - 新导入的书签排在最后

### 管理分类

- 书签库顶部的**分类标签**点击即筛选；「全部」「未分类」是固定标签（无右键菜单）
- **添加**：工具栏「添加分类」按钮（或 `Alt + Shift + N`），可选 Remix Icon 图标与颜色
- **编辑 / 删除**：右键分类标签；删除后其下书签自动归入「未分类」，不会丢失
- **排序**：分类标签按住拖拽即可调整顺序

### 管理书签

- **添加**：工具栏「添加网址」按钮（或 `Alt + N`），填写网址、名称、描述与归属分类
  - 输入网址后会自动探测并填充网站图标；探测失败时回退显示「标题首字头像」
- **打开**：点击书签卡片，在新标签页打开
- **编辑 / 复制链接 / 删除**：右键书签卡片
- 新书签固定排在最后；编辑书签不改动排序

### 搜索

- **站内即时搜索**：在首页搜索框输入关键词，即时匹配站内书签
- **网页搜索**：输入关键词或网页链接后按 `Enter`，按当前搜索引擎检索
- **切换引擎**：按 `Tab` 循环切换搜索引擎（百度 / Google / GitHub 等），`Shift + Tab` 保留浏览器原生焦点回退
- 随时按 `Alt + K` 聚焦搜索框

### 站点设置

顶栏齿轮打开设置面板，可进行：

- **网站名称**：自定义站点标题（清空即恢复默认）
- **头像**：上传 png/jpeg/webp 图片，自动压缩为 128×128
- **导入书签 / 导出书签**：HTML 批量导入；导出 JSON 备份文件
- **退出登录**：清除本设备的登录状态

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + K` | 聚焦搜索框 |
| `Alt + N` | 添加书签 |
| `Alt + Shift + N` | 添加分类 |
| `Escape` | 关闭模态框/菜单 |

> 说明：Ctrl+N / Ctrl+Shift+N 是浏览器保留快捷键（新建窗口），网页无法拦截，故使用 Alt 组合键；Alt+K 原为 Ctrl+K，因与输入法/扩展冲突改为 Alt 系。

---

## 部署教程

部署目标为 **Cloudflare Workers**：`vite build` 的静态资源由 Workers Static Assets 托管，API 由同一个 Worker 处理，数据存 D1。免费计划即可满足个人使用。

### 前置条件

- [Cloudflare 账号](https://dash.cloudflare.com/)（免费计划即可）
- Node.js 22+（Vite 8 与 Wrangler 4 的最低要求）与 pnpm
- 获取代码并安装依赖（wrangler 随项目依赖安装，后文一律用 `pnpm exec wrangler` 调用，无需全局安装）：

```bash
git clone <repository-url>
cd NavBase
pnpm install
```

### 第 1 步：登录 Cloudflare

```bash
pnpm exec wrangler login
```

浏览器完成 OAuth 授权即可；`pnpm exec wrangler whoami` 可确认登录状态。

### 第 2 步：创建 D1 数据库

```bash
pnpm exec wrangler d1 create navbase-db
```

将输出中的 `database_id` 填入 `wrangler.toml` 的 `[[d1_databases]]` 段。

### 第 3 步：初始化数据库 Schema

**本地库与线上库是两个独立的库，需分别执行**（可重复执行，默认分类为幂等插入）：

```bash
# 本地开发库（日常开发用，不带 --remote）
pnpm exec wrangler d1 execute navbase-db --file=schema.sql --local

# 线上库（部署前执行一次）
pnpm exec wrangler d1 execute navbase-db --file=schema.sql --remote
```

### 第 4 步：配置管理员密码（Secret）

```bash
pnpm exec wrangler secret put ADMIN_PASSWORD
pnpm exec wrangler secret put ADMIN_USERNAME   # 可选，默认 admin
```

按提示交互输入，值不会出现在代码与日志中。**未配置 `ADMIN_PASSWORD` 时所有 API 会被拒绝（返回 500）**，这是防止无密码公开实例的 fail-closed 设计。

### 第 5 步：部署

```bash
pnpm deploy
```

等价于 `vite build` + `wrangler deploy`。完成后输出访问地址：`https://<worker 名>.workers.dev`。

### 第 6 步：验证

1. 打开部署地址，用第 4 步的账号密码登录
2. 可选：对线上跑一遍接口冒烟：

```bash
BASE_URL=https://<worker 名>.workers.dev ADMIN_PASSWORD=你的密码 bash scripts/test-api.sh
```

> 该脚本的测试 3/5 会写入少量测试数据（可在界面删除）；不带 `BASE_URL` 时默认测本地 `http://localhost:8788`，凭据自动读取 `.dev.vars`。

### 绑定自定义域名（正式使用推荐）

1. 将域名的 DNS 托管到 Cloudflare
2. Cloudflare 控制台 → Workers & Pages → 你的 Worker → **Settings → Domains & Routes → Add → Custom Domain**，填入域名
3. 生效后通过自有域名访问；站点图标代理的边缘缓存也会随之启用（`*.workers.dev` 下不缓存，仅略慢）

### 日常更新

```bash
pnpm deploy
```

### 备选：Workers Builds（Git 集成自动部署）

1. Cloudflare 控制台 → **Workers Builds** → 连接 GitHub 仓库
2. 构建命令填 `pnpm build`（Wrangler 配置沿用仓库根目录 `wrangler.toml`，含 D1 绑定与静态资源目录）
3. 在 Worker 设置中配置 Secret 类型的密码变量；首次部署后按第 3 步初始化线上库

### 环境变量

| 变量名 | 说明 | 配置方式 |
|--------|------|----------|
| `ADMIN_USERNAME` | 管理员用户名 | Secret 或 `.dev.vars`（默认 `admin`） |
| `ADMIN_PASSWORD` | 管理员密码 | Secret 或 `.dev.vars`（**必填，无默认值**） |
| `LOGIN_DURATION_DAYS` | 登录保持天数 | `wrangler.toml` [vars]（默认 `7`） |
| `REMEMBER_DURATION_DAYS` | 勾选「记住此设备」时的登录保持天数 | `wrangler.toml` [vars]（默认 `30`） |

> ⚠️ 密码属于凭据，不要写入 `wrangler.toml`（该文件会被 git 跟踪并随部署生效）。

### 数据库绑定

D1 绑定已在 `wrangler.toml` 中声明，部署时自动生效：

- 绑定名: `DB`
- 数据库: `navbase-db`

### 常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 所有 API 返回 500 `NOT_CONFIGURED` | 未配置 `ADMIN_PASSWORD`：本地写入 `.dev.vars`，线上执行 `wrangler secret put ADMIN_PASSWORD` |
| 报 `no such table` | Schema 未执行：本地库与线上库需分别执行第 3 步 |
| 登录提示「用户名或密码错误」 | 核对凭据来源（本地 `.dev.vars` / 线上 Secret）；修改 `.dev.vars` 后需重启 `dev:api` 才生效 |
| `dev:api` 启动异常提示缺少资源目录 | 先执行 `pnpm build` 生成 `dist/`（wrangler dev 同时托管静态资源） |
| 线上 favicon 每次都重新探测 | `*.workers.dev` 域名下 Cache API 不生效；绑定自定义域名后恢复 7 天缓存 |

---

## 本地开发

若尚未安装依赖或创建数据库，先完成部署教程的「前置条件」与第 2 步。

### 配置本地密码

在项目根目录创建 `.dev.vars`（已被 gitignore，切勿提交）：

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的密码
```

### 启动

```bash
# 同时启动前端 (5173) 与本地 API (8788)
pnpm dev:full

# 或分别启动
pnpm dev      # 仅前端
pnpm dev:api  # 仅 API（绑定与配置读取自 wrangler.toml / .dev.vars）
```

访问 http://localhost:5173

> 注：`pnpm dev:api` 需要 `dist/` 目录存在（wrangler dev 同时托管静态资源），首次使用前先跑一次 `pnpm build`。

### 构建

```bash
pnpm build
```

### 测试

```bash
pnpm test                                    # 全量运行
pnpm test:watch                              # 监听模式
pnpm test src/composables/useLunar.test.js   # 运行单个测试文件
bash scripts/test-api.sh                     # 本地 API 冒烟（需 dev:api 在跑）
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
│   ├── index.js          # 入口：认证门 + 路由表 + ASSETS 兜底
│   ├── auth.js           # Basic Auth 认证门
│   ├── routes/           # API 端点处理函数
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
