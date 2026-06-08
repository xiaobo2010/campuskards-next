#!/bin/bash
set -e
BACKUP_DIR="/ssd/7a40/campuskards/deploy/xiaoboserver/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker compose -f /ssd/7a40/campuskards/deploy/xiaoboserver/docker-compose.yml exec -T postgres \
  pg_dump -U ck campuskards | gzip > "${BACKUP_DIR}/daily_${TIMESTAMP}.sql.gz"
# 保留7天
find "${BACKUP_DIR}" -name "daily_*.sql.gz" -mtime +7 -delete
echo "✅ Backup done: daily_${TIMESTAMP}.sql.gz"
