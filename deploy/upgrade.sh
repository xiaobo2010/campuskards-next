#!/usr/bin/env bash
# ============================================================================
# CampusKards 一键升级脚本
# 非交互模式，适合 CI/CD 或快速部署
# 用法:
#   bash upgrade.sh [branch]          全量升级（前后端+迁移+重启）
#   SKIP_FRONTEND=true bash upgrade.sh 仅升级后端
#   SKIP_BACKEND=true bash upgrade.sh  仅升级前端
#   SKIP_RESTART=true bash upgrade.sh  构建但不重启
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/upgrade_${TIMESTAMP}.log"
LOCK_FILE="${SCRIPT_DIR}/upgrade.lock"

source "${SCRIPT_DIR}/lib/common.sh"

# ── 颜色 ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*" | tee -a "$LOG_FILE"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*" | tee -a "$LOG_FILE"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; }

# ── 并发锁 ──
if [[ -f "$LOCK_FILE" ]]; then
  pid_=$(cat "$LOCK_FILE" 2>/dev/null || true)
  if [[ -n "$pid_" ]] && kill -0 "$pid_" 2>/dev/null; then
    log_error "升级已在运行中 (PID: $pid_)，请等待或删除锁文件: $LOCK_FILE"
    exit 1
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── 配置 ──
BRANCH="${1:-main}"
SKIP_BACKEND="${SKIP_BACKEND:-false}"
SKIP_FRONTEND="${SKIP_FRONTEND:-false}"
SKIP_MIGRATE="${SKIP_MIGRATE:-false}"
SKIP_RESTART="${SKIP_RESTART:-false}"

mkdir -p "$LOG_DIR"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CampusKards 一键升级                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
log_info "分支: ${BRANCH}"
log_info "后端: $([[ "$SKIP_BACKEND" == "true" ]] && echo '跳过' || echo '执行')"
log_info "前端: $([[ "$SKIP_FRONTEND" == "true" ]] && echo '跳过' || echo '执行')"
log_info "迁移: $([[ "$SKIP_MIGRATE" == "true" || "$SKIP_BACKEND" == "true" ]] && echo '跳过' || echo '执行')"
log_info "重启: $([[ "$SKIP_RESTART" == "true" ]] && echo '跳过' || echo '执行')"
echo ""

# ═══════════════════════════════════════════════
# 阶段 1: 拉取代码
# ═══════════════════════════════════════════════
log_info "阶段 1/6: 拉取代码 (${BRANCH})..."
cd "$PROJECT_DIR"
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
git checkout "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
git pull origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
commit_hash=$(git rev-parse --short HEAD)
log_ok "代码已更新 (${BRANCH} @ ${commit_hash})"

# ═══════════════════════════════════════════════
# 阶段 2: 后端依赖
# ═══════════════════════════════════════════════
if [[ "$SKIP_BACKEND" != "true" ]]; then
  log_info "阶段 2/6: 安装后端依赖..."
  detect_python_tool >> "$LOG_FILE" 2>&1 || {
    log_error "未找到 Python 包管理器"
    exit 1
  }
  setup_venv "${PROJECT_DIR}/backend" >> "$LOG_FILE" 2>&1
  install_backend_deps "${PROJECT_DIR}/backend" 2>&1 | tee -a "$LOG_FILE"
  log_ok "后端依赖已更新 (${PYTHON_TOOL})"
else
  log_info "阶段 2/6: 跳过后端依赖"
fi

# ═══════════════════════════════════════════════
# 阶段 3: 数据库迁移
# ═══════════════════════════════════════════════
if [[ "$SKIP_MIGRATE" != "true" && "$SKIP_BACKEND" != "true" ]]; then
  log_info "阶段 3/6: 数据库迁移..."
  check_and_migrate_database "${PROJECT_DIR}/backend" false 2>&1 | tee -a "$LOG_FILE"
  log_ok "数据库迁移完成"
else
  log_info "阶段 3/6: 跳过数据库迁移"
fi

# ═══════════════════════════════════════════════
# 阶段 4: 前端构建（修复版本冲突）
# ═══════════════════════════════════════════════
if [[ "$SKIP_FRONTEND" != "true" ]]; then
  log_info "阶段 4/6: 构建前端..."
  cd "${PROJECT_DIR}/frontend"

  # 自动降级 eslint 版本（如果检测到使用 9.x）
  if grep -q '"eslint": "^9"' package.json; then
    log_info "检测到 eslint 9，降级到兼容版本..."
    sed -i 's/"eslint": "^9"/"eslint": "^8.57.0"/' package.json
  fi

  # 处理 package-lock.json 不一致问题
  if [[ -f "package-lock.json" ]]; then
    log_info "删除旧的 package-lock.json 以避免版本冲突..."
    rm -f package-lock.json
  fi
  if [[ -d "node_modules" ]]; then
    log_info "删除旧的 node_modules 以确保干净安装..."
    rm -rf node_modules
  fi

  # 使用 --legacy-peer-deps 安装依赖
  log_info "安装依赖 (npm install --legacy-peer-deps)..."
  npm install --legacy-peer-deps 2>&1 | tee -a "$LOG_FILE"
  log_ok "依赖安装完成"

  log_info "执行前端构建 (npm run build)..."
  npm run build 2>&1 | tee -a "$LOG_FILE"
  log_ok "npm run build 完成"

  if ! copy_standalone_assets "${PROJECT_DIR}/frontend" 2>&1 | tee -a "$LOG_FILE"; then
    log_error "静态资源复制或验证失败！"
    exit 1
  fi

  # 构建产物大小
  if [[ -d ".next" ]]; then
    build_size=$(du -sh .next 2>/dev/null | cut -f1)
    log_info "构建产物: .next/ (${build_size})"
  fi

  log_ok "前端构建完成"
else
  log_info "阶段 4/6: 跳过前端构建"
fi

cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════
# 阶段 5: 重启服务
# ═══════════════════════════════════════════════
if [[ "$SKIP_RESTART" != "true" ]]; then
  log_info "阶段 5/6: 重启服务..."
  sudo systemctl daemon-reload

  if [[ "$SKIP_BACKEND" != "true" ]]; then
    log_info "重启 campuskards-backend..."
    sudo systemctl restart campuskards-backend
    sleep 3
    if sudo systemctl is-active --quiet campuskards-backend; then
      log_ok "后端运行中"
    else
      log_error "后端启动失败: journalctl -u campuskards-backend -n 30"
    fi
  fi

  if [[ "$SKIP_FRONTEND" != "true" ]]; then
    log_info "重启 campuskards-frontend..."
    sudo systemctl restart campuskards-frontend
    sleep 3
    if sudo systemctl is-active --quiet campuskards-frontend; then
      log_ok "前端运行中"
    else
      log_error "前端启动失败: journalctl -u campuskards-frontend -n 30"
    fi
  fi
else
  log_info "阶段 5/6: 跳过重启"
fi

# ═══════════════════════════════════════════════
# 阶段 6: 验证
# ═══════════════════════════════════════════════
log_info "阶段 6/6: 部署验证..."

exit_code=0

if [[ "$SKIP_BACKEND" != "true" && "$SKIP_RESTART" != "true" ]]; then
  if sudo systemctl is-active --quiet campuskards-backend; then
    sudo systemctl status campuskards-backend --no-pager -l 2>&1 | head -3 | tee -a "$LOG_FILE"
  else
    log_error "后端未运行"
    exit_code=1
  fi
fi

if [[ "$SKIP_FRONTEND" != "true" && "$SKIP_RESTART" != "true" ]]; then
  if sudo systemctl is-active --quiet campuskards-frontend; then
    sudo systemctl status campuskards-frontend --no-pager -l 2>&1 | head -3 | tee -a "$LOG_FILE"

    # HTTP 健康检查
    frontend_port=$(get_frontend_port)
    sleep 2
    if curl -sfo /dev/null "http://127.0.0.1:${frontend_port}/" 2>/dev/null; then
      log_ok "HTTP 响应正常 (port ${frontend_port})"
    else
      log_warn "HTTP 无响应 (port ${frontend_port})，可能由 nginx 反代"
    fi
  else
    log_error "前端未运行"
    exit_code=1
  fi
fi

# ═══════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════
echo ""
log_info "═══════════════════════════════════════════════"
log_info "  升级完成"
log_info "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "  提交: ${commit_hash:-unknown}"
log_info "  日志: ${LOG_FILE}"
log_info "═══════════════════════════════════════════════"
echo ""

exit $exit_code
