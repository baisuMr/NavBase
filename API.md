# NavManager API 文档

## 认证方式

使用 HTTP Basic Auth 认证：
- 用户名：由 `ADMIN_USERNAME` 配置，默认 `admin`
- 密码：由 `ADMIN_PASSWORD` 配置（本地开发放 `.dev.vars`，线上用 `wrangler pages secret put ADMIN_PASSWORD` 配置，切勿写入仓库）

**注意**：除 `POST /api/auth/login` 外，所有请求（含 GET）都需要认证；未配置 `ADMIN_PASSWORD` 时服务端拒绝一切登录与访问。

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
    "icon": "⭐",
    "color": "#3B82F6",
    "sort_order": 1,
    "created_at": "2026-09-08 02:36:25",
    "updated_at": "2026-09-08 02:36:25"
  }
]
```

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
  "icon": "📁",
  "color": "#3B82F6",
  "sort_order": 0
}
```

#### 更新分类
```
PUT /api/categories/:id
Authorization: Basic base64(admin:password)
Content-Type: application/json

{
  "name": "新名称",
  "icon": "📁",
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
    "created_at": "2026-09-08 02:36:25",
    "updated_at": "2026-09-08 02:36:25",
    "category_name": "常用",
    "category_icon": "⭐",
    "category_color": "#3B82F6"
  }
]
```

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
  "category_id": 1,
  "icon_url": "https://favicon.im/example.com",
  "sort_order": 0
}
```

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
  "icon_url": "https://favicon.im/example.com"
}
```

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
    { "title": "书签标题", "url": "https://example.com", "description": "", "category_id": 1, "icon_url": "" }
  ]
}
```

**说明**：
- 单次最多 500 条，URL 仅允许 http/https 协议
- 批内与库内双重去重，重复书签自动跳过
- 返回 `{ "success": true, "count": 3, "skipped": 2 }`，count 为实际导入数量，skipped 为去重跳过数量

---

### Favicon API

#### 获取网站图标（图片代理）
```
GET /api/favicon/:domain
```

**免认证**：`<img>` 标签无法携带 Basic Auth 头，该端点在中间件中放行；仅返回公开网站图标（域名由调用方提供），不含任何用户数据。

**响应**：成功返回 `200` + 图片字节（`Cache-Control: public, max-age=604800`，响应头 `X-Favicon-Source` 标明命中的源）；全部源失败返回 `404`（缓存 10 分钟）。

**说明**：
- 并发探测以下图标源（单源 3 秒超时），取最先返回有效图片者：
  1. 目标站根路径 `https://{domain}/favicon.ico`（本地/国内网络可达性最好）
  2. favicon.im
  3. DuckDuckGo
  4. Google Favicon（Cloudflare 边缘可达性最好）
- 响应经图片魔数校验（PNG/GIF/JPEG/BMP/ICO/WebP/SVG），错误页等非图片内容视为失败；单图上限 512KB
- 结果经 Cache API 缓存：成功 7 天，失败 10 分钟
- 域名格式校验：仅接受合法 hostname，防止拼接路径/内网地址（SSRF）

**前端约定**：书签 `icon_url` 为空时由 `useFavicon` 组合式函数自动拼 `/api/favicon/{域名}` 渲染，加载失败回退「标题首字头像」，调用方无需单独处理。

---

### 站点设置 API

#### 读取站点设置
```
GET /api/settings
```

**响应示例**：
```json
{
  "site_name": "栞记",
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
  "password": "your-password"
}
```

**响应示例**：
```json
{
  "token": "YWRtaW46eW91ci1wYXNzd29yZA==",
  "expiresAt": 1758240000000,
  "durationDays": 7,
  "username": "admin",
  "success": true
}
```

**说明**：
- `username` 与 `password` 均必填，缺失返回 400
- token 是 Base64 编码的 `username:password`，可用于后续请求的 Basic Auth 认证
- `expiresAt` 为过期时间戳（毫秒），前端存 localStorage 据此控制登录保持；保持天数由 `LOGIN_DURATION_DAYS` 配置（默认 7 天）
- 登录失败统一延迟约 800ms 后返回，作为简易防爆破措施

---

## 错误响应

所有错误响应格式：
```json
{
  "error": "错误信息"
}
```

常见状态码：
- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `404` - 资源不存在
- `405` - 方法不允许
- `500` - 服务器错误

---

## 测试 API

启动开发服务器后，运行测试脚本：
```bash
bash test-api.sh
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
