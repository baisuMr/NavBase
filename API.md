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
- 返回 `{ "success": true, "count": 1 }`，count 为实际导入数量

---

### Favicon API

#### 获取网站图标
```
GET /api/favicon/:domain
```

**响应示例**：
```json
{
  "url": "https://favicon.im/github.com"
}
```

**说明**：按以下顺序尝试获取图标：
1. favicon.im（国内源）
2. DuckDuckGo
3. Google Favicon
4. 网站根目录

---

### 认证 API

#### 登录
```
POST /api/auth/login
Content-Type: application/json

{
  "password": "your-password"
}
```

**响应示例**：
```json
{
  "token": "YWRtaW46eW91ci1wYXNzd29yZA==",
  "success": true
}
```

**说明**：返回的 token 是 Base64 编码的 `admin:password`，可用于后续请求的 Basic Auth 认证。

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
