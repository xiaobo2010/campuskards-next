#!/bin/bash
set -e
cd "$(dirname "$0")"

# 加载环境变量
set -a; source .env; set +a

BACKUP_DIR="/ssd/7a40/campuskards/deploy/xiaoboserver/backups"
DB_NAME="campuskards"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "${BACKUP_DIR}"

echo "📦 备份数据库 ${DB_NAME}..."
PGPASSWORD="${DB_PASSWORD}" pg_dump -U "${DB_USER:-ck}" -h localhost "${DB_NAME}" | \
  gzip > "${BACKUP_DIR}/daily_${TIMESTAMP}.sql.gz"

# 保留最近 7 天
find "${BACKUP_DIR}" -name "daily_*.sql.gz" -mtime +7 -delete

echo "✅ 备份完成：daily_${TIMESTAMP}.sql.gz (保留 7 天)"
