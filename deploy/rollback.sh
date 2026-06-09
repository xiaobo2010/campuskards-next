#!/usr/bin/env bash
# ============================================================================
# CampusKards 回滚脚本
# 支持回滚前端/后端/数据库到指定 Git 提交或上一个部署版本
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/rollback_${TIMESTAMP}.log"

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
echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
echo -e "${RED}║     CampusKards 回滚工具                    ║${NC}"
echo -e "${RED}║     操作不可逆，请谨慎使用                  ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 环境检查 ──
for cmd in git; do
  if ! command -v "$cmd" &>/dev/null; then
    error "缺少命令: $cmd"
    exit 1
  fi
done

detect_python_tool 2>/dev/null || true

# ── 获取提交历史 ──
echo -e "${CYAN}最近 10 个提交:${NC}"
echo ""
git -C "$PROJECT_DIR" log --oneline -10 2>&1 | nl -w2 -s') '
echo ""

read -r -p "$(echo -e "${YELLOW}?${NC} 输入要回滚到的提交哈希 (留空取消): ")" TARGET_COMMIT
if [[ -z "$TARGET_COMMIT" ]]; then
  info "回滚已取消"
  exit 0
fi

# ── 验证提交是否存在 ──
if ! git -C "$PROJECT_DIR" cat-file -e "$TARGET_COMMIT^{commit}" 2>/dev/null; then
  error "无效的提交哈希: $TARGET_COMMIT"
  exit 1
fi

COMMIT_INFO=$(git -C "$PROJECT_DIR" log --oneline -1 "$TARGET_COMMIT")
log_info "目标提交: $COMMIT_INFO"
echo ""

# ── 选择回滚范围 ──
echo -e "${CYAN}请选择回滚范围:${NC}"
echo "  1) 仅回滚代码（前端 + 后端，保留数据库）"
echo "  2) 回滚代码 + 数据库迁移（降级）"
echo "  3) 仅回滚数据库迁移"
echo "  4) 取消"
read -r -p "$(echo -e "${YELLOW}?${NC} 输入编号 [1-4]: ")" scope
echo ""

case "$scope" in
  1)
    log_info "回滚代码到 ${TARGET_COMMIT}..."
    git -C "$PROJECT_DIR" reset --hard "$TARGET_COMMIT"
    log_ok "代码已回滚"

    if confirm "重新构建并重启服务?"; then
      if confirm "构建前端?" "n"; then
        cd "${PROJECT_DIR}/frontend"
        npm ci && npm run build 2>&1 | tee -a "$LOG_FILE"
        copy_standalone_assets "${PROJECT_DIR}/frontend" 2>&1 | tee -a "$LOG_FILE"
        sudo systemctl restart campuskards-frontend || true
      fi
      if confirm "重启后端?"; then
        sudo systemctl restart campuskards-backend || true
      fi
      log_ok "服务已重启"
    fi
    ;;
  2)
    log_info "回滚代码到 ${TARGET_COMMIT}..."
    git -C "$PROJECT_DIR" reset --hard "$TARGET_COMMIT"
    log_ok "代码已回滚"

    log_info "查找目标提交对应的数据库迁移版本..."
    setup_venv "${PROJECT_DIR}/backend"

    log_info "当前迁移版本:"
    run_alembic "${PROJECT_DIR}/backend" current 2>&1 | tee -a "$LOG_FILE"
    log_info "迁移历史:"
    run_alembic "${PROJECT_DIR}/backend" history 2>&1 | tee -a "$LOG_FILE"

    echo ""
    read -r -p "$(echo -e "${YELLOW}?${NC} 输入降级目标版本标识 (留空取消): ")" DOWN_REV
    if [[ -n "$DOWN_REV" ]]; then
      log_info "降级数据库到 ${DOWN_REV}..."
      if confirm "降级操作不可逆，确认继续?" "n"; then
        run_alembic "${PROJECT_DIR}/backend" downgrade "$DOWN_REV" 2>&1 | tee -a "$LOG_FILE"
        log_ok "数据库已降级"
      fi
    fi

    if confirm "重启后端服务?"; then
      sudo systemctl restart campuskards-backend
      log_ok "后端服务已重启"
    fi
    ;;
  3)
    setup_venv "${PROJECT_DIR}/backend"
    log_info "当前迁移版本:"
    run_alembic "${PROJECT_DIR}/backend" current 2>&1 | tee -a "$LOG_FILE"
    log_info "迁移历史:"
    run_alembic "${PROJECT_DIR}/backend" history 2>&1 | tee -a "$LOG_FILE"
    echo ""
    read -r -p "$(echo -e "${YELLOW}?${NC} 输入降级目标版本标识 (留空取消): ")" DOWN_REV
    if [[ -n "$DOWN_REV" ]]; then
      if confirm "降级操作不可逆，确认继续?" "n"; then
        run_alembic "${PROJECT_DIR}/backend" downgrade "$DOWN_REV" 2>&1 | tee -a "$LOG_FILE"
        log_ok "数据库已降级"
        if confirm "重启后端服务?"; then
          sudo systemctl restart campuskards-backend
        fi
      fi
    fi
    ;;
  4)
    info "回滚已取消"
    exit 0
    ;;
  *)
    error "无效选项"
    exit 1
    ;;
esac

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  回滚操作完成${NC}"
echo -e "${YELLOW}  时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${YELLOW}  日志: ${LOG_FILE}${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════${NC}"
echo ""
warn "回滚后请验证服务状态：sudo systemctl status campuskards-backend campuskards-frontend"
echo ""
