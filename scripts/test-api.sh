#!/bin/bash

# API 测试脚本
# 使用方法: 启动开发服务器（pnpm dev:full 或 pnpm dev:api）后运行 bash scripts/test-api.sh
# 凭据读取顺序：环境变量 ADMIN_USERNAME / ADMIN_PASSWORD > 项目根 .dev.vars > 用户名默认 admin
# 可用 BASE_URL 覆盖接口地址（默认 http://localhost:8788）
# 注意: 测试 3/5 会向本地库写入测试数据（测试分类、Google 书签），可在界面中删除

BASE_URL="${BASE_URL:-http://localhost:8788}"
DEV_VARS="$(cd "$(dirname "$0")/.." && pwd)/.dev.vars"

# 从 .dev.vars 读取单个键值（去行尾 CR 与成对引号）
read_dev_var() {
  local line val
  line=$(grep -E "^$1=" "$DEV_VARS" 2>/dev/null | tail -1)
  [ -z "$line" ] && return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;
    \'*\') val="${val#\'}"; val="${val%\'}" ;;
  esac
  printf '%s' "$val"
}

ADMIN_USERNAME="${ADMIN_USERNAME:-$(read_dev_var ADMIN_USERNAME)}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(read_dev_var ADMIN_PASSWORD)}"

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "错误: 未找到 ADMIN_PASSWORD（请配置 .dev.vars 或设置环境变量）" >&2
  exit 1
fi

AUTH="$ADMIN_USERNAME:$ADMIN_PASSWORD"
# 密码含双引号/反斜杠时需手动调整该 JSON
LOGIN_BODY=$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USERNAME" "$ADMIN_PASSWORD")

# 发起请求并输出状态码与截断后的响应体（响应体经临时文件，规避二进制内容的空字节告警）
TMP_BODY=$(mktemp)
trap 'rm -f "$TMP_BODY"' EXIT

req() {
  local desc="$1"; shift
  local code
  code=$(curl -s --max-time 15 -o "$TMP_BODY" -w '%{http_code}' "$@")
  echo -e "\n[测试 $desc] HTTP $code"
  head -c 200 "$TMP_BODY"
  echo ""
}

echo "=========================================="
echo "NavBase API 测试 ($BASE_URL)"
echo "=========================================="

# 测试 1: 获取分类列表（需要认证）
req "1: GET /api/categories" -u "$AUTH" "$BASE_URL/api/categories"

# 测试 2: 获取单个分类（需要认证）
req "2: GET /api/categories/1" -u "$AUTH" "$BASE_URL/api/categories/1"

# 测试 3: 创建分类（需要认证，写入测试数据）
req "3: POST /api/categories" -u "$AUTH" -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"测试分类","icon":"ri-flask-line","color":"#FF6B6B"}' \
  "$BASE_URL/api/categories"

# 测试 4: 获取书签列表（需要认证）
req "4: GET /api/bookmarks" -u "$AUTH" "$BASE_URL/api/bookmarks"

# 测试 5: 创建书签（需要认证，写入测试数据）
req "5: POST /api/bookmarks" -u "$AUTH" -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Google","url":"https://www.google.com","description":"搜索引擎"}' \
  "$BASE_URL/api/bookmarks"

# 测试 6: 获取 Favicon（免认证的公开图片代理）
req "6: GET /api/favicon/github.com" "$BASE_URL/api/favicon/github.com"

# 测试 7: 登录（免认证）
req "7: POST /api/auth/login" -X POST \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" "$BASE_URL/api/auth/login"

# 测试 8: 未认证访问（应该返回 401）
req "8: POST /api/bookmarks (无认证，期望 401)" -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","url":"https://test.com"}' "$BASE_URL/api/bookmarks"

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
