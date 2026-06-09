#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"

if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "错误: 未找到 ${SCRIPT_DIR}/.env，请先复制 .env.example 并填写配置"
  exit 1
fi

# shellcheck disable=SC1091
set -a; source "${SCRIPT_DIR}/.env"; set +a

DB_NAME="${DB_NAME:-campuskards}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "${BACKUP_DIR}"

echo "备份数据库 ${DB_NAME}..."
PGPASSWORD="${DB_PASSWORD}" pg_dump -U "${DB_USER:-ck}" -h localhost "${DB_NAME}" | \
  gzip > "${BACKUP_DIR}/daily_${TIMESTAMP}.sql.gz"

# 保留最近 7 天
find "${BACKUP_DIR}" -name "daily_*.sql.gz" -mtime +7 -delete

echo "备份完成：daily_${TIMESTAMP}.sql.gz (保留 7 天)"
