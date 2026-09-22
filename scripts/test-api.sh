#!/bin/bash

# API 测试脚本
# 使用方法: 启动开发服务器后运行此脚本

BASE_URL="http://localhost:8788"
AUTH="admin:your-admin-password"

echo "=========================================="
echo "NavBase API 测试"
echo "=========================================="

# 测试 1: 获取分类列表
echo -e "\n[测试 1] GET /api/categories"
curl -s "$BASE_URL/api/categories" | head -c 200
echo ""

# 测试 2: 获取单个分类
echo -e "\n[测试 2] GET /api/categories/1"
curl -s "$BASE_URL/api/categories/1" | head -c 200
echo ""

# 测试 3: 创建分类（需要认证）
echo -e "\n[测试 3] POST /api/categories"
curl -s -X POST "$BASE_URL/api/categories" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试分类","icon":"ri-flask-line","color":"#FF6B6B"}' | head -c 200
echo ""

# 测试 4: 获取书签列表
echo -e "\n[测试 4] GET /api/bookmarks"
curl -s "$BASE_URL/api/bookmarks" | head -c 200
echo ""

# 测试 5: 创建书签（需要认证）
echo -e "\n[测试 5] POST /api/bookmarks"
curl -s -X POST "$BASE_URL/api/bookmarks" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"title":"Google","url":"https://www.google.com","description":"搜索引擎"}' | head -c 200
echo ""

# 测试 6: 获取Favicon
echo -e "\n[测试 6] GET /api/favicon/github.com"
curl -s "$BASE_URL/api/favicon/github.com" | head -c 200
echo ""

# 测试 7: 登录
echo -e "\n[测试 7] POST /api/auth/login"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}' | head -c 200
echo ""

# 测试 8: 未认证访问（应该返回401）
echo -e "\n[测试 8] POST /api/bookmarks (无认证)"
curl -s -X POST "$BASE_URL/api/bookmarks" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","url":"https://test.com"}' | head -c 200
echo ""

echo -e "\n=========================================="
echo "测试完成"
echo "=========================================="
