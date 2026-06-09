#!/usr/bin/env bash
# 后端服务器一键部署（非交互，供 CI/cron 使用）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$DEPLOY_DIR")"

source "${DEPLOY_DIR}/lib/common.sh"
LOG_FILE="/dev/stdout"

detect_python_tool

echo "=== CampusKards 部署 ==="
echo ""

echo "拉取最新代码..."
git -C "$PROJECT_DIR" pull origin main

echo "安装后端依赖..."
setup_venv "${PROJECT_DIR}/backend"
install_backend_deps "${PROJECT_DIR}/backend"

echo "构建前端..."
cd "${PROJECT_DIR}/frontend"
npm ci
npm run build
copy_standalone_assets "${PROJECT_DIR}/frontend"

echo "数据库迁移..."
check_and_migrate_database "${PROJECT_DIR}/backend" false || {
  echo "迁移失败。若旧库未 stamp，请交互式运行: bash deploy/deploy-backend.sh"
  exit 1
}

echo "重启服务..."
sudo systemctl daemon-reload
sudo systemctl restart campuskards-backend campuskards-frontend

echo ""
echo "部署完成 $(date)"
sudo systemctl status campuskards-backend --no-pager -l | head -5
sudo systemctl status campuskards-frontend --no-pager -l | head -5
