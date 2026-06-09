#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== CampusKards systemd 部署 ==="
echo ""

# ── 1. 拉取最新代码 ──
echo "📥 拉取最新代码..."
cd ../..
git pull origin main

# ── 2. 安装后端依赖 ──
echo "📦 安装后端依赖..."
cd backend
if [ ! -d ".venv" ]; then
    uv venv
fi
source .venv/bin/activate
uv sync --no-dev
cd ..

# ── 3. 构建前端 ──
echo "🏗️ 构建前端..."
cd frontend
npm ci
npm run build
cd ..

# ── 4. 运行数据库迁移 ──
echo "🗄️ 运行数据库迁移..."
cd backend
source .venv/bin/activate
uv run alembic upgrade head
cd ..

# ── 5. 重启服务 ──
echo "🚀 重启服务..."
sudo systemctl daemon-reload
sudo systemctl restart campuskards-backend
sudo systemctl restart campuskards-frontend

echo ""
echo "✅ 部署完成！$(date)"
echo ""
echo "后端状态："
sudo systemctl status campuskards-backend --no-pager -l | head -5
echo ""
echo "前端状态："
sudo systemctl status campuskards-frontend --no-pager -l | head -5
