#!/usr/bin/env bash
# ============================================================================
# CampusKards 后端独立部署脚本
# 可独立执行：依赖安装 → 数据库迁移 → 服务重启
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/backend_${TIMESTAMP}.log"

source "${SCRIPT_DIR}/lib/common.sh"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
log()   { echo -e "$*" | tee -a "$LOG_FILE"; }
log_info()  { log "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { log "${GREEN}[OK]${NC}    $*"; }
log_error() { log "${RED}[ERROR]${NC} $*"; }

confirm() {
  local prompt="$1" default="${2:-y}"
  local yn
  case "$default" in y|Y) prompt_str="[Y/n]"; default="y" ;; n|N) prompt_str="[y/N]"; default="n" ;; esac
  read -r -p "$(echo -e "${YELLOW}?${NC} ${prompt} ${prompt_str} ")" yn
  yn="${yn:-$default}"
  [[ "$yn" =~ ^[yY] ]]
}

mkdir -p "$LOG_DIR"

# ============================================================================
clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CampusKards 后端部署                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 阶段 1: 环境检查 ──
echo -e "${CYAN}────────────────── 1/5  环境检查 ──────────────────${NC}"

for cmd in git python3; do
  if ! command -v "$cmd" &>/dev/null; then
    error "缺少命令: $cmd"
    exit 1
  fi
done

if ! detect_python_tool >> "$LOG_FILE" 2>&1; then
  exit 1
fi
log_info "Python 包管理器: ${PYTHON_TOOL}"

# Python 版本
PY_VER=$(python3 --version 2>/dev/null | awk '{print $2}')
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
info "Python: $PY_VER"
if [[ "$PY_MAJOR" -lt 3 || "$PY_MINOR" -lt 12 ]]; then
  warn "推荐 Python >= 3.12，当前为 $PY_VER"
  confirm "继续?" || exit 0
fi

# Git 状态
if git -C "$PROJECT_DIR" status --porcelain | grep -q .; then
  warn "工作区有未提交的更改:"
  git -C "$PROJECT_DIR" status --short
  confirm "继续?" || exit 0
fi

# 系统服务
for svc in postgresql redis; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    ok "系统服务 $svc 运行中"
  else
    warn "系统服务 $svc 未运行（部署后需手动检查）"
  fi
done
echo ""

# ── 阶段 2: 拉取代码 ──
echo -e "${CYAN}────────────────── 2/5  拉取代码 ──────────────────${NC}"
DEFAULT_BRANCH="main"
read -r -p "$(echo -e "${YELLOW}?${NC} 分支名 [${DEFAULT_BRANCH}]: ")" BRANCH
BRANCH="${BRANCH:-$DEFAULT_BRANCH}"

git -C "$PROJECT_DIR" fetch origin "$BRANCH"
git -C "$PROJECT_DIR" checkout "$BRANCH"
git -C "$PROJECT_DIR" pull origin "$BRANCH"
log_ok "代码已更新 (${BRANCH})"
echo ""

# ── 阶段 3: 依赖安装 ──
echo -e "${CYAN}────────────────── 3/5  安装 Python 依赖 ──────────${NC}"
BACKEND_DIR="${PROJECT_DIR}/backend"

setup_venv "$BACKEND_DIR"
install_backend_deps "$BACKEND_DIR" 2>&1 | tee -a "$LOG_FILE"
log_ok "Python 依赖安装完成"
echo ""

# ── 阶段 4: 数据库迁移 ──
echo -e "${CYAN}────────────────── 4/5  数据库迁移 ────────────────${NC}"
if confirm "迁移前备份数据库?"; then
  if [[ -f "${DEPLOY_SERVER_DIR}/backup.sh" ]]; then
    bash "${DEPLOY_SERVER_DIR}/backup.sh" 2>&1 | tee -a "$LOG_FILE"
  else
    log_info "备份脚本不存在，跳过备份"
  fi
fi

check_and_migrate_database "$BACKEND_DIR" true
cd "$PROJECT_DIR"
echo ""

# ── 阶段 5: 重启服务 ──
echo -e "${CYAN}────────────────── 5/5  重启服务 ──────────────────${NC}"
if confirm "重启后端服务 (campuskards-backend)?"; then
  sudo systemctl daemon-reload
  sudo systemctl restart campuskards-backend
  sleep 3
  if sudo systemctl is-active --quiet campuskards-backend; then
    log_ok "后端服务 运行中"
    sudo systemctl status campuskards-backend --no-pager -l | head -3
  else
    log_error "后端服务 启动失败，查看日志: journalctl -u campuskards-backend -n 50"
  fi
fi
echo ""

# ── 完成 ──
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  后端部署完成${NC}"
echo -e "${GREEN}  时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${GREEN}  日志: ${LOG_FILE}${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
