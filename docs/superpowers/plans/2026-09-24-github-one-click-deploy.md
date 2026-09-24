# GitHub 一键部署 + D1 Schema 自动初始化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让公开仓库点击「Deploy to Cloudflare」按钮即可完整上线（含 D1 自动建表与管理员密码引导），README 同步改写为一键部署教程。

**Architecture:** 新增 `worker/schema-init.js`，在 Worker 处理 API 路由前惰性检测三张关键表，缺失则以 `exec` 幂等执行根目录 `schema.sql`（经 wrangler `[[rules]]` Text 以文本 import，单一数据源）；入口路由集成 + mock/vitest 配套。README 重写为一键部署教程，新增 `.dev.vars.example` 供部署流程引导填写密码。

**Tech Stack:** Cloudflare Workers (wrangler 4.133)、D1、Vitest + 自定义 transform 插件。

**Spec:** 本次会话研究结论（Deploy to Cloudflare button 机制：克隆仓库、自动创建 D1 并回写 `database_id`、Workers Builds CI/CD、读取 `.dev.vars.example` 引导填 Secret；D1 自动创建后为空库，需应用侧自建表）。用户已确认：方案 A（worker 自动建表）、配套改动（`.dev.vars.example` + README 重写 + 本地开发章节自包含）、仓库后续设为公开。

## Global Constraints

- 注释/文案全部中文；错误响应沿用 `Response.json({ error: '...' }, { status })` 风格，错误码大写下划线（参照现有 `NOT_CONFIGURED`）
- `schema.sql` 是唯一数据源：worker 通过 wrangler `[[rules]]` Text loader import，**不得**复制第二份 SQL
- Git 提交：中文、`类型: 描述`、描述动词开头 ≤50 字、不加句号/emoji/署名
- 线上 D1 操作必须 `--remote`；本计划不涉及线上操作
- 组件样式禁止硬编码颜色（本计划不涉及前端样式）
- 测试文件与被测代码同目录；vitest 默认 node 环境

---

### Task 1: schema-init 模块 + mock/vitest/wrangler 配套

**Files:**
- Create: `worker/schema-init.js`
- Create: `worker/schema-init.test.js`
- Modify: `worker/utils/mock-d1.js`（加 `exec`）
- Modify: `wrangler.toml`（加 `[[rules]]`）
- Modify: `vitest.config.js`（加 `.sql` 文本 transform 插件）

**Interfaces:**
- Produces: `ensureSchema(env: { DB }) => Promise<void>` —— Task 2 入口集成使用；模块级 promise 缓存（同一 isolate 只探测一次），失败后清缓存允许重试
- Produces: mock `createMockDB().exec(sql)` —— 记录 `{ sql, method: 'exec' }`

- [ ] **Step 1: 配置三处基础设施**

`wrangler.toml` 顶部（`name` 段之后、`[assets]` 之前）插入：

```toml
# 让 worker 以文本形式 import 根目录 schema.sql（单一数据源，避免 SQL 双份维护）
[[rules]]
type = "Text"
globs = ["**/*.sql"]
```

`worker/utils/mock-d1.js` 的返回对象中，`batch` 之后新增：

```js
    // 幂等执行多语句 SQL（schema 初始化用）
    async exec(sql) {
      calls.push({ sql, args: [], method: 'exec' })
      return handler({ sql, args: [], method: 'exec' }) ?? { meta: {} }
    }
```

`vitest.config.js` 整体替换为：

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 让测试中以文本形式 import .sql（与 wrangler.toml [[rules]] Text 对齐）
  plugins: [
    {
      name: 'import-sql-as-text',
      transform(code, id) {
        if (id.endsWith('.sql')) {
          return { code: `export default ${JSON.stringify(code)}`, map: null }
        }
      }
    }
  ],
  test: {
    environment: 'node',
    include: ['worker/**/*.test.js', 'src/**/*.test.js']
    // 需要 DOM 的测试文件在顶部标注：// @vitest-environment happy-dom
  }
})
```

- [ ] **Step 2: 写失败测试** `worker/schema-init.test.js`

```js
// schema 自动初始化：空库建表 / 已建库跳过 / 失败可重试 / 同 isolate 只探测一次
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDB } from './utils/mock-d1.js'

// 模块级缓存跨用例污染，每个用例重置模块取全新实例
beforeEach(() => vi.resetModules())

const load = () => import('./schema-init.js').then(m => m.ensureSchema)

describe('ensureSchema', () => {
  it('空库（表缺失）时幂等执行全量 schema.sql', async () => {
    const ensureSchema = await load()
    const db = createMockDB() // 默认 first() 返回 null → 视为表缺失
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'first' && c.sql.includes('sqlite_master'))).toBe(true)
    expect(db.calls.filter(c => c.method === 'exec')).toHaveLength(1)
    const execSql = db.calls.find(c => c.method === 'exec').sql
    expect(execSql).toContain('CREATE TABLE IF NOT EXISTS bookmarks')
    expect(execSql).toContain("INSERT INTO categories")
  })

  it('三张关键表齐全时跳过初始化', async () => {
    const ensureSchema = await load()
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('sqlite_master')) return { cnt: 3 }
    })
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'exec')).toBe(false)
  })

  it('部分表缺失（旧库）也会执行幂等 schema 补齐', async () => {
    const ensureSchema = await load()
    const db = createMockDB(({ sql, method }) => {
      if (method === 'first' && sql.includes('sqlite_master')) return { cnt: 2 }
    })
    await ensureSchema({ DB: db })
    expect(db.calls.some(c => c.method === 'exec')).toBe(true)
  })

  it('初始化失败后可重试（缓存被清除）', async () => {
    const ensureSchema = await load()
    let fail = true
    const db = createMockDB(({ method }) => {
      if (method === 'exec' && fail) { fail = false; throw new Error('boom') }
    })
    await expect(ensureSchema({ DB: db })).rejects.toThrow('boom')
    await expect(ensureSchema({ DB: db })).resolves.toBeUndefined()
    expect(db.calls.filter(c => c.method === 'exec')).toHaveLength(2)
  })

  it('同一 DB 二次调用复用缓存，只探测一次', async () => {
    const ensureSchema = await load()
    const db = createMockDB()
    await ensureSchema({ DB: db })
    await ensureSchema({ DB: db })
    expect(db.calls.filter(c => c.method === 'first')).toHaveLength(1)
    expect(db.calls.filter(c => c.method === 'exec')).toHaveLength(1)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm test worker/schema-init.test.js`
Expected: FAIL（无法解析 `./schema-init.js`）

- [ ] **Step 4: 实现** `worker/schema-init.js`

```js
// D1 schema 自动初始化：首个 API 请求检测关键表，缺失则幂等执行根目录 schema.sql
// （经 wrangler.toml [[rules]] Text loader 以文本 import，单一数据源，勿在 worker 内复制 SQL）
import schemaSql from '../schema.sql';

// 关键表全齐才视为已初始化：旧库缺任何一张都会触发幂等补齐（CREATE TABLE IF NOT EXISTS）
const REQUIRED_TABLE_COUNT = 3; // categories / bookmarks / settings

let readyPromise = null;

async function init(env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name IN ('categories', 'bookmarks', 'settings')"
  ).first();
  if (row && row.cnt === REQUIRED_TABLE_COUNT) return;
  // schema.sql 全部为 IF NOT EXISTS / 条件插入，并发 isolate 重复执行安全
  await env.DB.exec(schemaSql);
}

export async function ensureSchema(env) {
  if (!readyPromise) {
    readyPromise = init(env).catch((err) => {
      readyPromise = null; // 失败后清缓存，下次请求重试
      throw err;
    });
  }
  return readyPromise;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test worker/schema-init.test.js`
Expected: PASS（5 个用例）

- [ ] **Step 6: 全量回归**

Run: `pnpm test`
Expected: 全部 PASS（mock 新增 exec 不影响现有用例）

- [ ] **Step 7: Commit**

```bash
git add worker/schema-init.js worker/schema-init.test.js worker/utils/mock-d1.js wrangler.toml vitest.config.js
git commit -m "feat: 新增 D1 schema 首次请求自动初始化"
```

---

### Task 2: 入口集成 ensureSchema

**Files:**
- Modify: `worker/index.js:2`（新增 import）与 `fetch` 分发段（`worker/index.js:74-77`）
- Modify: `worker/index.test.js`（新增 3 个用例）

**Interfaces:**
- Consumes: Task 1 的 `ensureSchema(env)`；mock 的 `exec`

- [ ] **Step 1: 写失败测试** —— `worker/index.test.js` 文件末尾（现有 `describe` 之后）追加：

```js
describe('schema 自动初始化集成', () => {
  // schema-init 有模块级缓存，须与入口一起取全新模块实例
  const freshWorker = async () => {
    vi.resetModules()
    return (await import('./index.js')).default
  }

  it('首个 API 请求触发建表：探测 sqlite_master 并执行全量 schema', async () => {
    const w = await freshWorker()
    const env = makeEnv()
    const res = await w.fetch(req('/api/bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(200)
    expect(env.DB.calls.some(c => c.method === 'first' && c.sql.includes('sqlite_master'))).toBe(true)
    expect(env.DB.calls.some(c => c.method === 'exec' && c.sql.includes('CREATE TABLE'))).toBe(true)
  })

  it('favicon 请求不触发数据库初始化', async () => {
    const w = await freshWorker()
    const env = makeEnv()
    await w.fetch(req('/api/favicon/localhost'), env, {})
    expect(env.DB.calls).toHaveLength(0)
  })

  it('初始化失败返回 500 DB_INIT_FAILED', async () => {
    const w = await freshWorker()
    const env = makeEnv(createMockDB(({ method }) => {
      if (method === 'exec') throw new Error('boom')
    }))
    const res = await w.fetch(req('/api/bookmarks', { headers: AUTH }), env, {})
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('DB_INIT_FAILED')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test worker/index.test.js`
Expected: 新增 3 用例 FAIL（无 sqlite_master 探测记录 / 无 DB_INIT_FAILED）

- [ ] **Step 3: 实现** —— `worker/index.js`：

import 区（`auth.js` 之后）加：

```js
import { ensureSchema } from './schema-init.js';
```

fetch 分发段替换为：

```js
    const matched = matchRoute(new URL(request.url).pathname);
    if (matched) {
      // favicon 是免认证高频接口且不依赖 DB，跳过初始化；其余 API 路由（含登录）
      // 首次请求惰性建表，保证一键部署出的空库开箱即用
      if (matched.handler !== handleFavicon) {
        try {
          await ensureSchema(env);
        } catch (err) {
          console.error('schema init failed', err);
          return Response.json({ error: 'DB_INIT_FAILED' }, { status: 500 });
        }
      }
      return matched.handler(request, env, matched.params, ctx);
    }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test worker/index.test.js`
Expected: PASS（含原有 8 用例——mock 默认 `first()` 为 null 会走一次 exec，不影响其断言）

- [ ] **Step 5: Commit**

```bash
git add worker/index.js worker/index.test.js
git commit -m "feat: 入口路由集成 schema 惰性初始化"
```

---

### Task 3: 本地端到端验证（空库自动建表）

**Files:** 无代码改动（验证任务）

**Interfaces:** Consumes Task 1/2 成果。注意：用户已有 dev 服务器在跑，验证用**独立端口 + 独立 persist 目录**，互不干扰（参见记忆：残留 workerd 抢端口导致请求挂起）。

- [ ] **Step 1: 空库起独立实例**

```bash
rm -rf .wrangler/tmp-verify
pnpm exec wrangler dev --port 8789 --persist-to .wrangler/tmp-verify
```

等待就绪后保持运行（可在后台/另一终端）。

- [ ] **Step 2: 冒烟验证**

```bash
# 未带凭据 → 401（认证门在初始化之前生效）
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8789/api/bookmarks
# 带本地 .dev.vars 凭据 → 200，且首次请求已自动建表、默认分类随 schema 插入
curl -s -u admin:<.dev.vars 中的密码> http://localhost:8789/api/categories
```

Expected: 第一条输出 `401`；第二条输出含 `常用`/`开发` 等默认分类的 JSON 数组。

- [ ] **Step 3: 清理**

结束 8789 的 wrangler dev（Windows 下若残留：`netstat -ano | findstr 8789` 后 `taskkill //PID <pid> //T //F`），并 `rm -rf .wrangler/tmp-verify`。

---

### Task 4: `.dev.vars.example` + README 一键部署改写 + CLAUDE.md 微调

**Files:**
- Create: `.dev.vars.example`
- Modify: `README.md`（整文件重写）
- Modify: `CLAUDE.md`（核心设计加一条）

**Interfaces:** Consumes：Task 1/2 的自动建表（README 中「无需手动建表」的依据）；Deploy to Cloudflare 按钮机制（读取 `.dev.vars.example` 引导填 Secret、自动建 D1 并回写 ID、Workers Builds CI/CD）。

- [ ] **Step 1: 创建 `.dev.vars.example`**

```dotenv
# 复制为 .dev.vars 用于本地开发（已 gitignore）。
# Deploy to Cloudflare 一键部署流程也会读取本文件，在部署设置页引导填写同名 Secret。
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password-here
```

- [ ] **Step 2: 重写 README.md**（完整内容如下，直接整文件替换）

````markdown
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
3. 在部署设置页：
   - 可自定义仓库名与 Worker 名称
   - 填写管理员用户名与密码（对应 Secret `ADMIN_USERNAME` / `ADMIN_PASSWORD`）
4. 等待构建部署完成，访问 `https://<worker 名>.workers.dev`，用刚才的账号密码登录即可使用

### 一键部署自动完成了什么

- 将本仓库克隆到你的 GitHub 账号（后续可自由修改）
- 创建 D1 数据库并绑定到 Worker（`database_id` 自动回写进你仓库的 `wrangler.toml`）
- **首次请求自动建表**（worker 检测到空库时幂等执行 `schema.sql`，无需手动初始化）
- 配置 Workers Builds：之后 `git push` 到 main 分支即自动构建重新部署，Pull Request 自动生成预览 URL

### 日常更新

```bash
git pull && git push   # 或直接在你的仓库修改后 push
```

Workers Builds 检测到推送后自动重新部署，无需任何本地命令。

### 绑定自定义域名（可选）

1. 将域名的 DNS 托管到 Cloudflare
2. Cloudflare 控制台 → Workers & Pages → 你的 Worker → **Settings → Domains & Routes → Add → Custom Domain**，填入域名
3. 绑定后站点图标代理的边缘缓存随之启用（`*.workers.dev` 下不缓存，仅略慢）

### 环境变量

| 变量名 | 说明 | 配置方式 |
|--------|------|----------|
| `ADMIN_USERNAME` | 管理员用户名 | Secret（一键部署时填写，默认 `admin`） |
| `ADMIN_PASSWORD` | 管理员密码 | Secret（一键部署时填写，**必填**） |
| `LOGIN_DURATION_DAYS` | 登录保持天数 | `wrangler.toml` [vars]（默认 `7`） |
| `REMEMBER_DURATION_DAYS` | 勾选「记住此设备」时的登录保持天数 | `wrangler.toml` [vars]（默认 `30`） |

> ⚠️ 密码属于凭据，不要写入 `wrangler.toml`（该文件会被 git 跟踪并随部署生效）。

### 常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 所有 API 返回 500 `NOT_CONFIGURED` | 未配置 `ADMIN_PASSWORD`：一键部署时漏填，前往 Worker **Settings → Variables & Secrets** 补配后重试 |
| 所有 API 返回 500 `DB_INIT_FAILED` | D1 初始化失败：检查 Worker 的 **Settings → Bindings** 中 D1 绑定是否存在，修复后重试（worker 会自动重试建表） |
| 登录提示「用户名或密码错误」 | 核对 Secret 中的凭据；修改后需重新部署或等待缓存刷新 |
| 线上 favicon 每次都重新探测 | `*.workers.dev` 域名下 Cache API 不生效；绑定自定义域名后恢复 7 天缓存 |

---

## 本地开发

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
````

- [ ] **Step 3: CLAUDE.md 核心设计新增一条**（「导入导出」条目之后）：

```markdown
- **Schema 自动初始化**: worker 首次 API 请求探测关键表（favicon 路由除外），缺失时幂等执行根目录 `schema.sql`（经 wrangler `[[rules]]` Text 以文本 import，单一数据源，勿在 worker 内复制 SQL）；`wrangler d1 execute` 手动建表仅作备用
```

- [ ] **Step 4: 验证文档链接与事实**

- `pnpm test` 全量回归通过
- README 中按钮 URL 为 `https://deploy.workers.cloudflare.com/?url=https://github.com/baisuMr/NavBase`（无 `.git` 后缀）
- 全文不再出现「使用教程」「第 3 步：初始化数据库 Schema」等已删除章节的引用

- [ ] **Step 5: Commit**

```bash
git add .dev.vars.example README.md CLAUDE.md
git commit -m "chore: 新增 dev.vars 示例供一键部署读取"
git commit -m "docs: README 改为 GitHub 一键部署教程"
```

（注：两条分开提交，`.dev.vars.example` 为 chore、README/CLAUDE.md 为 docs；第二条单独执行 `git add README.md CLAUDE.md`）

---

## Self-Review 记录

- **Spec 覆盖**：方案 A（Task 1/2/3）✓；`.dev.vars.example`（Task 4）✓；README 一键部署改写+去使用教程+零成本介绍（Task 4）✓；本地开发自包含（Task 4）✓；日常更新改 git push（Task 4）✓
- **占位符扫描**：无 TBD/TODO；README 与 `.dev.vars.example` 均为完整内容
- **类型一致性**：`ensureSchema(env)` 在 Task 1 定义、Task 2 消费一致；mock `exec(sql)` 记录结构 `{ sql, args, method: 'exec' }` 与断言一致；错误码 `DB_INIT_FAILED` 三处（实现/测试/README FAQ）一致
