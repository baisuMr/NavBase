# NavBase：Pages → Workers 迁移设计（定稿）

- 日期：2026-09-23
- 状态：已实施（本文档为迁移设计与实施记录）
- 决策人：用户（要求「最纯正的 Worker 应用，而非仅仅兼容」）

## 0. 目标与约束

- 产出**原生 Worker 应用**：标准 `export default { fetch }` 模块入口 + 显式路由，彻底移除 Pages Functions 约定（`functions/`、`_middleware.js`、`onRequest(context)`）
- **功能、API 契约（路径/方法/状态码/JSON 形态）、样式零变化**；前端 `src/` 与 `vite.config.js` 零改动
- D1 **数据零迁移**（沿用同一 `database_id`，本地/远程命令不变）
- 零新增运行时依赖

## 1. 总体架构

```
请求
 └─ 全量先进 Worker.fetch（run_worker_first = true）
       ① 认证门 authGate（原 _middleware.js 逻辑逐行平移）
       ② 路由表匹配 → 资源处理函数 → JSON
       ③ 未匹配 → env.ASSETS.fetch（静态资源直出 / SPA 回退）
```

注：`run_worker_first` 的 glob 对大小写敏感。实测（2026-09-23 冒烟）数组形态 `["/api/*"]` 会把 `/API/`
等变体导去 SPA 回退（200 HTML）而绕过认证门的 401 契约，故采用 `true` 全量 Worker 优先——
与原 Pages 中间件「所有请求先过认证门」精确等价。代价是静态资源请求也计入 Worker 调用（自用流量可忽略）。

关键配置语义（已对照官方文档与 wrangler 4.133 schema 逐项核实）：

- `run_worker_first = true`：所有请求先过认证门（含浏览器地址栏直开、大小写/编码变体，返回 401 JSON 与迁移前一致）
- `not_found_handling = "single-page-application"`：SPA 回退（`/login`、`/` 刷新不 404），`env.ASSETS.fetch` 同样应用该配置（官方 binding 文档明确）
- `compatibility_date = "2024-01-01"` **保持不变**（迁移指南：沿用原值以锁定运行时行为；后续可专项升级）

## 2. wrangler.toml（迁移后）

```toml
name = "navbase"
main = "./worker/index.js"
compatibility_date = "2024-01-01"

[assets]
directory = "./dist"                # vite 构建产物照旧，前端零改动
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true             # 全量 Worker 优先（glob 大小写敏感，数组形态有变体绕过缺口）

[observability]
enabled = true

[observability.traces]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "navbase-db"
database_id = "be7711a1-76f4-4c81-80fc-36bd92168612"   # 原样：同一库，数据零迁移

[vars]
LOGIN_DURATION_DAYS = "7"
REMEMBER_DURATION_DAYS = "30"
```

## 3. 目录布局与模块映射

```
worker/
├── index.js          # export default { fetch }：认证门 → 路由表 → ASSETS 兜底
├── auth.js           # 原 _middleware.js（逐行平移，含 secureCompare 常数时间比较）
├── routes/
│   ├── login.js      # 原 api/auth/login.js
│   ├── bookmarks.js  # 原 bookmarks/index.js + [id].js + batch.js
│   ├── categories.js # 原 categories/index.js + [id].js + sort.js
│   ├── settings.js   # 原 settings/index.js
│   └── favicon.js    # 原 favicon/[domain].js
└── utils/validate.js # 原样平移（mock-d1.js 随测试平移）
```

| 现文件 | 新文件 | 改动 |
|---|---|---|
| `_middleware.js` | `auth.js` | `onRequest(context)` → `authGate(request, env)` 返回 `null \| Response`，逻辑逐行保留 |
| 各端点 | `routes/*` | 签名 → `handler(request, env, params, ctx)`；业务逻辑、方法校验、CORS/OPTIONS、错误 JSON 逐行保留 |
| `favicon/[domain].js` | `routes/favicon.js` | `context.waitUntil` → `ctx.waitUntil`，其余原样 |
| `utils/validate.js` | `utils/validate.js` | 零改动 |
| 各 `*.test.js` | `worker/**/*.test.js` | import 与调用签名改造，业务断言全部保留 |

处理函数约定：`(request, env, params, ctx)`——`params.id`/`params.domain` 以**字符串**传入（与 Pages 一致，不做数字转换）。

## 4. 路由表（字面量优先于参数段，顺序固定）

```
/api/auth/login       → login.handle
/api/bookmarks        → bookmarks.collection
/api/bookmarks/batch  → bookmarks.batch        ← 字面量，先于 :id
/api/bookmarks/:id    → bookmarks.item
/api/categories       → categories.collection
/api/categories/sort  → categories.sort        ← 字面量，先于 :id
/api/categories/:id   → categories.item
/api/settings         → settings.handle
/api/favicon/:domain  → favicon.handle
（未匹配）            → env.ASSETS.fetch(request)
```

路径匹配统一归一化（decode、合并连续斜杠、小写比较、去末尾斜杠；param 值保留原始大小写），与 Pages 函数路由的大小写不敏感行为对齐；方法分发仍在各处理函数内（405/OPTIONS 形态不变）。

## 5. 行为保真清单（逐项守住）

1. **认证门逐行平移**：OPTIONS 放行 → `/api/` 前缀归一化判定 fail-closed → 登录接口**精确豁免**（尾斜杠不豁免）→ favicon GET 豁免 → 未配 `ADMIN_PASSWORD` 返回 500 → Basic 校验（首个冒号分割、非法 base64 不崩溃，用户名/密码改常数时间比较）→ 失败统一 800ms 延迟
2. **路由语义**：`batch`/`sort` 字面量优先（现注释已声明的约定）；大小写/尾斜杠/编码路径的防护行为不降级（由 `run_worker_first = true` + 归一化路由保证）
3. **错误契约**：405/400/404/500 的 JSON `{ error }` 形态与文案原样
4. **favicon**：Cache API（成功 7 天/失败 10 分钟）+ `ctx.waitUntil` 写缓存原样；workers.dev 阶段 Cache API 不缓存（仅略慢、功能无损），绑自定义域名后恢复
5. **登录防爆破**：失败 800ms 延迟（`setTimeout` 与 Pages 同一 workerd 运行时，行为一致）

## 6. 测试策略

- 全部测试随代码平移至 `worker/` 同目录（保持项目「测试与被测同目录」约定），node 环境不变
- **`pnpm test` 全绿是迁移正确性的硬门槛**——断言不动，改的只是调用接线
- 新增 `worker/index.test.js`：路由分发冒烟（字面量优先、归一化匹配、ASSETS 兜底被调用）
- 新增 `worker/routes/login.test.js`（原项目无登录测试，补齐）

## 7. 开发 / 构建 / 部署

| 项 | 迁移前 | 迁移后 |
|---|---|---|
| `dev:api` | `wrangler pages dev`（8788） | `wrangler dev --port 8788`（vite 代理零改动） |
| `dev:full` | concurrently 双进程 | 不变 |
| `deploy` | `wrangler pages deploy dist` | `pnpm build && wrangler deploy` |
| 密钥 | `wrangler pages secret put X` | `wrangler secret put X`（`.dev.vars` 本地用法不变） |
| D1 | `wrangler d1 execute … [--remote]` | 不变 |
| 前端构建 | `vite build` → `dist/` | 不变 |

文档同步：`README.md`、`CLAUDE.md`、`API.md`、`待办事项.md` 中 Pages 表述与路径引用全部更新。

## 8. 实施步骤（有序，TDD：先测试红、后实现绿）

1. 平移改造全部测试 → RED（模块缺失）→ 平移 `utils/`、`auth.js`、`routes/*`、`index.js` → GREEN（85 测试通过）
2. 改造 `wrangler.toml`、`package.json` scripts、`vitest.config.js` include；删除 `functions/`（git 历史保留可恢复）
3. 全量 `pnpm test`（151 通过）+ `pnpm build` + `wrangler deploy --dry-run`（绑定/打包校验）
4. 文档更新
5. 本地 `wrangler dev` 冒烟 → 部署 `navbase` → `*.workers.dev` 冒烟
6. 验证通过后删除 Pages 项目（经用户确认）；正式上线时把自定义域名绑到该 Worker

**冒烟清单**（步骤 5/7 共用）：未登录 API 401 JSON；`/API/`、`//api/` 变体 401；登录成功/失败（含延迟）；登录 GET→405；书签 CRUD + batch 去重导入；分类 CRUD + `PUT /api/categories/sort`；设置读写；favicon 出图；SPA 刷新 `/login` 不 404；**地址栏直开 `/api/bookmarks` 返回 401 JSON 而非 HTML**；前端资源正常加载。

本地首轮冒烟结果（2026-09-23）：11 项中 10 项通过；`/API/bookmarks` 变体 401 契约在 `run_worker_first = ["/api/*"]`
下失效（glob 大小写敏感），已改 `run_worker_first = true` 修复并复验。

## 9. 切换与回滚

- 验证期内 **Pages 项目保留**；回滚只需切回 Pages 部署（D1 同库，无数据风险）
- 开发阶段：迁移即切 `*.workers.dev`；正式期绑自定义域名即完成上线

## 10. 已知细微差异（可接受）

- workers.dev 阶段 favicon 不落缓存（每次真实探测，3 秒内多源竞速），自定义域名后恢复 7 天缓存
- 极端编码路径（如 `/api%2F…`）按归一化路径路由（与 Pages 大小写不敏感路由对齐）；认证门 fail-closed 防护不变
- 静态资源请求经 `run_worker_first = true` 会各计一次 Worker 调用（迁移指南已注明该计费口径；自用流量可忽略。若未来可接受大小写变体的响应差异，可换回 `["/api/*"]` 数组形态省这部分调用）

## 11. 明确不做（YAGNI）

- 不引入 Hono/路由库（9 条路由手写约 40 行，保持零后端依赖）
- 不引入 `@cloudflare/vite-plugin`（开发链路维持双进程；如需单进程体验，后续独立优化）
- 不升级 `compatibility_date`（后续专项处理）
- favicon 保留 Cache API（其负面缓存/手动键属细粒度控制场景，符合官方定位）
- 前端 `src/`、CSS、`vite.config.js` 零改动

## 12. Workers 最佳实践落实（cloudflare:workers-best-practices）

- `ctx.waitUntil(...)` 直接调用（不解构）；无模块级可变请求状态
- 凭据比较改 Web Crypto 常数时间比较（`secureCompare`，auth.js 与 login.js 共用）
- 开启 Workers Logs + Traces（`observability.enabled` / `observability.traces.enabled`）
- 密钥仅经 Wrangler secrets / `.dev.vars`，不入配置与源码
- 配置字段对照项目锁定的 `wrangler@4.133` config-schema 核实；部署前 `wrangler deploy --dry-run` 校验打包与绑定
