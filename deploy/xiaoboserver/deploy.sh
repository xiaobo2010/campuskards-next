#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "📥 拉取最新代码..."
cd ../..
git pull origin main

echo "🏗️ 构建后端镜像..."
docker compose -f deploy/xiaoboserver/docker-compose.yml build backend

echo "🚀 重启服务..."
docker compose -f deploy/xiaoboserver/docker-compose.yml up -d

echo "📦 运行数据库迁移..."
docker compose -f deploy/xiaoboserver/docker-compose.yml exec backend uv run alembic upgrade head

echo "✅ 部署完成！$(date)"
docker compose -f deploy/xiaoboserver/docker-compose.yml ps
