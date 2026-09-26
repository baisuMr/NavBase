# NavBase API 文档

## 认证方式

使用 HTTP Basic Auth 认证：
- 用户名：由 `ADMIN_USERNAME` 配置，默认 `admin`
- 密码：由 `ADMIN_PASSWORD` 配置（本地开发放 `.dev.vars`，线上用 `wrangler secret put ADMIN_PASSWORD` 配置，切勿写入仓库）

**注意**：除 `POST /api/auth/login` 外，所有请求（含 GET）都需要认证；`GET /api/favicon/:domain` 例外——`<img>` 无法携带 Basic Auth 头，改用持证 URL：必须携带 `?k=<key>`（由登录凭据派生，见 Favicon API 说明），并要求浏览器图片请求上下文（`Sec-Fetch-Dest: image` + `Sec-Fetch-Site: same-origin`）。未配置 `ADMIN_PASSWORD` 时服务端拒绝所有 API 请求（登录接口返回 500）。

## API 端点

### 分类 API

#### 获取所有分类
```
GET /api/categories
```

**响应示例**：
```json
[
  {
    "id": 1,
    "name": "常用",
    "icon": "ri-star-line",
    "color": "#2563EB",
    "sort_order": 1,
    "created_at": "2026-09-08 02:36:25",
    "updated_at": "2026-09-08 02:36:25"
  }
]
```

**字段说明**：`icon` 为 [Remix Icon](https://remixicon.com/) 图标名（如 `ri-folder-line`，统一使用 `-line` 变体）；非 `ri-` 开头的值前端会回退为默认图标。

#### 获取单个分类
```
GET /api/categories/:id
```

#### 创建分类
```
POST /api/categories
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "name": "分类名称",
  "icon": "ri-folder-line",
  "color": "#10b981"
}
```

**说明**：`icon`/`color` 可缺省，默认分别为 `ri-folder-line` / `#10b981`；`sort_order` 由服务端管理（新建固定排最后），客户端传值无效。

#### 重排分类
```
PUT /api/categories/sort
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "ids": [3, 1, 2]
}
```

**说明**：按 `ids` 顺序重编 `sort_order`（1..n）。`ids` 须与库内现有分类 id 集合完全一致（非空、无重复），否则返回 400。与 `PUT /api/categories/:id` 分工：编辑分类不改排序。

#### 更新分类
```
PUT /api/categories/:id
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "name": "新名称",
  "icon": "ri-folder-line",
  "color": "#3B82F6"
}
```

#### 删除分类
```
DELETE /api/categories/:id
Authorization: Basic base64(admin:password)
```

**注意**：删除分类会将该分类下的书签的 `category_id` 设为 `null`。

---

### 书签 API

#### 获取所有书签
```
GET /api/bookmarks
```

**响应示例**：
```json
[
  {
    "id": 1,
    "title": "Google",
    "url": "https://www.google.com",
    "description": "搜索引擎",
    "category_id": 1,
    "icon_url": "https://favicon.im/google.com",
    "sort_order": 0,
    "is_pinned": 1,
    "created_at": "2026-09-08 02:36:25",
    "updated_at": "2026-09-08 02:36:25",
    "category_name": "常用",
    "category_icon": "ri-star-line",
    "category_color": "#2563EB"
  }
]
```

（响应中的 `icon_url` 为兼容位，已弃用：前端不再读写，图标由 `/api/favicon` 代理统一探测。）

#### 获取单个书签
```
GET /api/bookmarks/:id
```

#### 创建书签
```
POST /api/bookmarks
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "title": "书签标题",
  "url": "https://example.com",
  "description": "描述",
  "category_id": 1
}
```

**说明**：`sort_order` 由服务端管理（新建固定排最后），客户端传值无效；`category_id` 可缺省或为 `null`（未分类）；创建时忽略 `is_pinned`（新建恒未固定，固定到首屏走更新接口）；`icon_url` 已弃用，无需传入（图标由 `/api/favicon` 代理统一探测）。

#### 更新书签
```
PUT /api/bookmarks/:id
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "title": "新标题",
  "url": "https://example.com",
  "description": "新描述",
  "category_id": 1,
  "is_pinned": 1
}
```

**说明**：`is_pinned` 为固定到首屏标记（0/1 或布尔值），**缺省表示不修改**（编辑书签保留固定状态），显式传值才写入；转固定时服务端校验上限，已有 10 个固定时返回 400「最多固定 10 个书签」；取消固定不受上限影响。

#### 删除书签
```
DELETE /api/bookmarks/:id
Authorization: Basic base64(admin:password)
```

#### 批量导入书签
```
POST /api/bookmarks/batch
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "bookmarks": [
    { "title": "书签标题", "url": "https://example.com", "description": "", "category_id": 1 }
  ]
}
```

**说明**：
- 单次最多 500 条，URL 仅允许 http/https 协议
- 批内与库内双重去重，重复书签自动跳过
- 导入的书签默认未固定（即使携带 `is_pinned` 也不写入）
- 返回 `{ "success": true, "count": 3, "skipped": 2 }`，count 为实际导入数量，skipped 为去重跳过数量

---

### Favicon API

#### 获取网站图标（图片代理）
```
GET /api/favicon/:domain?k=<key>
```

**来源校验（先于鉴权）**：仅接受页面内图片请求（`Sec-Fetch-Dest: image` 且 `Sec-Fetch-Site: same-origin`，fail-closed），其余（地址栏直接打开、iframe 嵌入、curl 等）返回 `403 FORBIDDEN_CONTEXT`。

**鉴权（持证 URL，后于来源校验）**：`<img>` 无法携带 Basic Auth 头，故本端点以 `?k=` 参数鉴权——`k = base64url(sha256("navbase-favicon:v1\n" + token))`，`token` 为登录接口下发的 Basic 凭据；改管理员密码后旧 k 全部失效。在来源校验通过后，缺失或错误的 k 返回 `401 UNAUTHORIZED`；未配置 `ADMIN_PASSWORD` 返回 `500 NOT_CONFIGURED`（最先校验）。

**响应**：成功返回 `200` + 图片字节（`Cache-Control: public, max-age=604800`，响应头 `X-Favicon-Source` 标明命中的源）；全部源失败返回 `200` + 空 body（`Content-Type: image/png`，缓存 10 分钟）——**不使用 404**，避免浏览器对失败子资源打印控制台错误。所有响应带 `Content-Security-Policy: sandbox` 与 `X-Content-Type-Options: nosniff`。

**说明**：
- 并发探测以下图标源（单源 3 秒超时），取最先返回有效图片者：
  1. 解析目标站首页 HTML 的 `<link rel="icon">` / `apple-touch-icon` 声明（清晰度与覆盖率最优；首页只读前 256KB）
  2. 目标站根路径 `https://{domain}/favicon.ico`（本地/国内网络可达性最好）
  3. favicon.im
  4. DuckDuckGo
  5. Google Favicon（Cloudflare 边缘可达性最好）
- 响应经内容定型（PNG/GIF/JPEG/BMP/ICO/WebP 魔数 + SVG 文本嗅探），错误页等非图片内容视为失败；单图上限 512KB。**支持 SVG 图标**，但含危险构造（`<script>`、`on*=` 事件属性、`<foreignobject>`、`javascript:`、`data:text/html`、DOCTYPE/ENTITY、`<?xml-stylesheet`）的 SVG 整份拒绝、跳到下一源（检测前先解码 XML 字符引用并去除 scheme 内嵌空白，防 `javascrip&#116;:` 类绕过）；UTF-16 编码的 SVG 同样拒绝
- 结果经 Cache API 缓存：成功 7 天，失败 10 分钟
- 域名格式校验：仅接受合法 hostname，防止拼接路径/内网地址（SSRF）；重定向最多跟随 3 跳，且每跳目标同样必须是合法域名（杜绝跳转到内网 IP/localhost）

**前端约定**：图标一律由 `useFavicon` 组合式函数拼 `/api/favicon/{域名}?k={key}` 渲染（k 由登录凭据派生，登录/启动时初始化），加载失败回退「标题首字头像」；书签 `icon_url` 字段已弃用（前端不再读写，历史直链不再使用）。

---

### 站点设置 API

#### 读取站点设置
```
GET /api/settings
```

**响应示例**：
```json
{
  "site_name": "NavBase",
  "avatar": "data:image/webp;base64,..."
}
```

#### 更新站点设置
```
PUT /api/settings
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "site_name": "我的导航",
  "avatar": "data:image/webp;base64,..."
}
```

**说明**：
- 仅支持 `site_name` 与 `avatar` 两个键（服务端白名单）
- 字段值为**空字符串**表示清除并恢复默认；**缺省**（不传）表示不修改
- `site_name` 不超过 30 字；`avatar` 为前端压缩后的 128×128 png/jpeg/webp dataURL（上限 200KB）

---

### 认证 API

#### 登录
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password",
  "remember": false
}
```

**响应示例**：
```json
{
  "token": "YWRtaW46eW91ci1wYXNzd29yZA==",
  "expiresAt": 1758240000000,
  "durationDays": 7,
  "remember": false,
  "username": "admin",
  "success": true
}
```

**说明**：
- `username` 与 `password` 均必填，缺失返回 400
- `remember` 可选：为 `true` 时保持天数取 `REMEMBER_DURATION_DAYS`（默认 30 天），否则取 `LOGIN_DURATION_DAYS`（默认 7 天）
- token 是 Base64 编码的 `username:password`，可用于后续请求的 Basic Auth 认证
- `expiresAt` 为过期时间戳（毫秒），由前端存储控制登录保持（勾选「记住此设备」存 localStorage，否则存 sessionStorage）；服务端不校验 token 过期，凭据在修改密码前始终有效
- 登录失败统一延迟约 800ms 后返回，作为简易防爆破措施

---

## 错误响应

所有错误响应格式：
```json
{
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

- `error`：中文错误文案，供人阅读与前端展示（前端只读该字段）
- `code`：机器可读的错误码，便于排障与程序分支处理；取值如下表

| `code` | 含义 |
|--------|------|
| `NOT_CONFIGURED` | 服务端缺少必需配置（如 `ADMIN_PASSWORD` 未设置） |
| `UNAUTHORIZED` | 未携带认证凭据 |
| `INVALID_CREDENTIALS` | 用户名或密码错误 |
| `AUTH_ERROR` | 认证过程异常（凭据无法解析或比较失败） |
| `VALIDATION_ERROR` | 请求参数或请求体校验失败 |
| `FORBIDDEN_CONTEXT` | 请求来源上下文不被允许（403，仅允许页面内图片请求） |
| `NOT_FOUND` | 资源或接口不存在 |
| `METHOD_NOT_ALLOWED` | 请求方法不支持 |
| `DB_INIT_FAILED` | 数据库初始化失败 |
| `CATEGORY_NOT_FOUND` | 书签引用的分类不存在（创建/更新书签时的 400 校验） |
| `INTERNAL_ERROR` | 服务端内部异常（500 兜底） |

常见状态码：
- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 来源上下文被拒（仅允许页面内图片请求）
- `404` - 资源不存在
- `405` - 方法不允许
- `500` - 服务器错误

---

## 测试 API

启动开发服务器后，运行测试脚本：
```bash
bash scripts/test-api.sh
```

或者使用 curl 手动测试：
```bash
# 获取分类列表
curl http://localhost:8788/api/categories

# 创建书签（需要认证）
curl -X POST http://localhost:8788/api/bookmarks \
  -u admin:your-admin-password \
  -H "Content-Type: application/json" \
  -d '{"title":"Google","url":"https://www.google.com"}'
```
