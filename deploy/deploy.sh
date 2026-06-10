#!/usr/bin/env bash
# ============================================================================
# CampusKards 部署总控脚本
# 交互式菜单，支持分别或同时部署前端、后端
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/deploy_${TIMESTAMP}.log"

source "${SCRIPT_DIR}/lib/common.sh"

# ── 颜色 ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m' # No Color

# ── 工具函数 ──
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

log() {
  echo -e "$*" | tee -a "$LOG_FILE"
}

log_info()  { log "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { log "${GREEN}[OK]${NC}    $*"; }
log_warn()  { log "${YELLOW}[WARN]${NC}  $*"; }
log_error() { log "${RED}[ERROR]${NC} $*"; }

confirm() {
  local prompt="$1" default="${2:-y}"
  local yn
  case "$default" in
    y|Y) prompt_str="[Y/n]"; default="y" ;;
    n|N) prompt_str="[y/N]"; default="n" ;;
  esac
  read -r -p "$(echo -e "${YELLOW}?${NC} ${prompt} ${prompt_str} ")" yn
  yn="${yn:-$default}"
  [[ "$yn" =~ ^[yY] ]]
}

check_command() {
  if ! command -v "$1" &>/dev/null; then
    error "缺少命令: $1，请先安装"
    exit 1
  fi
}

# ── 环境检查 ──
preflight_check() {
  log_info "────────────────── 环境检查 ──────────────────"

  local checks_ok=true

  # 项目目录
  if [[ ! -d "$PROJECT_DIR/.git" ]]; then
    log_error "项目根目录不是 git 仓库: $PROJECT_DIR"
    checks_ok=false
  fi

  # 系统命令
  for cmd in git node npm python3 systemctl; do
    if ! command -v "$cmd" &>/dev/null; then
      log_warn "命令 $cmd 未安装（若不需要可忽略）"
    fi
  done

  # Python 包管理器（uv 优先，无则回退 pip）
  if ! detect_python_tool >> "$LOG_FILE" 2>&1; then
    checks_ok=false
  else
    log_info "Python 包管理器: ${PYTHON_TOOL}"
  fi

  # Node 版本
  if command -v node &>/dev/null; then
    local node_ver
    node_ver=$(node --version 2>/dev/null | sed 's/v//')
    info "Node.js 版本: $node_ver"
    if [[ "$(echo "$node_ver" | cut -d. -f1)" -lt 18 ]]; then
      log_warn "Node.js >= 18 推荐，当前为 $node_ver"
    fi
  fi

  # Python 版本
  if command -v python3 &>/dev/null; then
    local py_ver
    py_ver=$(python3 --version 2>/dev/null | awk '{print $2}')
    info "Python 版本: $py_ver"
    if [[ "$(echo "$py_ver" | cut -d. -f1)" -lt 12 ]]; then
      log_warn "Python >= 3.12 推荐，当前为 $py_ver"
    fi
  fi

  # Git 状态
  if git -C "$PROJECT_DIR" status --porcelain | grep -q .; then
    log_warn "工作区有未提交的更改"
    git -C "$PROJECT_DIR" status --short
    if ! confirm "继续部署?"; then
      log_info "部署已取消"
      exit 0
    fi
  fi

  # 环境变量文件
  if [[ ! -f "${DEPLOY_SERVER_DIR}/.env" ]]; then
    log_warn "生产环境变量文件不存在: ${DEPLOY_SERVER_DIR}/.env"
    if [[ -f "${DEPLOY_SERVER_DIR}/.env.example" ]]; then
      info "参考模板: ${DEPLOY_SERVER_DIR}/.env.example"
    fi
    if ! confirm "继续（将使用默认配置）?" "n"; then
      log_info "部署已取消"
      exit 0
    fi
  fi

  # 磁盘空间
  local avail
  avail=$(df --output=avail "$PROJECT_DIR" 2>/dev/null | tail -1)
  if [[ -n "$avail" && "$avail" -lt 1048576 ]]; then
    log_warn "磁盘空间不足 1GB（剩余约 $((avail / 1024)) MB）"
    if ! confirm "继续?" "n"; then
      log_info "部署已取消"
      exit 0
    fi
  fi

  if $checks_ok; then
    log_ok "环境检查通过"
  fi
  echo ""
}

# ── Git 操作 ──
git_pull() {
  local branch="${1:-main}"
  log_info "拉取代码 (branch: ${branch})..."
  git -C "$PROJECT_DIR" fetch origin "$branch"
  git -C "$PROJECT_DIR" checkout "$branch"
  git -C "$PROJECT_DIR" pull origin "$branch"
  log_ok "代码已更新到最新"
}

# ── 部署后端 ──
deploy_backend() {
  echo ""
  log_info "═══════════════════════════════════════════════"
  log_info "          部署后端 (FastAPI)"
  log_info "═══════════════════════════════════════════════"

  local BACKEND_DIR="${PROJECT_DIR}/backend"

  setup_venv "$BACKEND_DIR"
  log_info "安装/同步依赖..."
  install_backend_deps "$BACKEND_DIR" 2>&1 | tee -a "$LOG_FILE"
  log_ok "后端依赖安装完成"

  # 数据库备份提示
  if confirm "运行迁移前备份数据库?"; then
    log_info "备份数据库中..."
    bash "${DEPLOY_SERVER_DIR}/backup.sh" 2>&1 | tee -a "$LOG_FILE" || log_warn "数据库备份失败，跳过"
  fi

  # 数据库迁移（含版本兼容性检查）
  check_and_migrate_database "$BACKEND_DIR" true

  cd "$PROJECT_DIR"
  echo ""
}

# ── 部署前端 ──
deploy_frontend() {
  echo ""
  log_info "═══════════════════════════════════════════════"
  log_info "          部署前端 (Next.js)"
  log_info "═══════════════════════════════════════════════"

  local FRONTEND_DIR="${PROJECT_DIR}/frontend"
  cd "$FRONTEND_DIR"

  log_info "安装依赖 (npm ci)..."
  npm ci 2>&1 | tee -a "$LOG_FILE"
  log_ok "前端依赖安装完成"

  log_info "构建 (npm run build)..."
  npm run build 2>&1 | tee -a "$LOG_FILE"
  log_ok "前端构建完成"

  copy_standalone_assets "$FRONTEND_DIR" 2>&1 | tee -a "$LOG_FILE"

  cd "$PROJECT_DIR"
  echo ""
}

# ── 重启服务 ──
restart_services() {
  local services=()
  [[ "${1:-}" == "backend" || "${1:-}" == "all" ]] && services+=("campuskards-backend")
  [[ "${1:-}" == "frontend" || "${1:-}" == "all" ]] && services+=("campuskards-frontend")

  if [[ ${#services[@]} -eq 0 ]]; then
    return
  fi

  log_info "重启服务: ${services[*]}..."
  sudo systemctl daemon-reload

  for svc in "${services[@]}"; do
    log_info "重启 ${svc}..."
    sudo systemctl restart "$svc"
    sleep 2
    if sudo systemctl is-active --quiet "$svc"; then
      log_ok "${svc} 运行中"
    else
      log_error "${svc} 启动失败，查看日志: journalctl -u ${svc} -n 50"
    fi
  done
}

# ── 验证部署 ──
verify_deployment() {
  local scope="${1:-all}"
  echo ""
  log_info "────────────────── 部署验证 ──────────────────"

  if [[ "$scope" == "all" || "$scope" == "backend" ]]; then
    if sudo systemctl is-active --quiet campuskards-backend; then
      log_ok "后端服务 运行中"
      sudo systemctl status campuskards-backend --no-pager -l 2>&1 | head -3
    else
      log_error "后端服务 未运行"
    fi
  fi

  if [[ "$scope" == "all" || "$scope" == "frontend" ]]; then
    if sudo systemctl is-active --quiet campuskards-frontend; then
      log_ok "前端服务 运行中"
      sudo systemctl status campuskards-frontend --no-pager -l 2>&1 | head -3
    else
      log_error "前端服务 未运行"
    fi
    # HTTP 健康检查
    local frontend_port
    frontend_port=$(get_frontend_port)
    if command -v curl &>/dev/null; then
      if curl -sfo /dev/null "http://127.0.0.1:${frontend_port}/" 2>/dev/null; then
        log_ok "前端 HTTP 响应正常 (port ${frontend_port})"
      else
        log_warn "前端 HTTP 无响应 (port ${frontend_port})，可能被 nginx 反代"
      fi
    fi
  fi

  echo ""
}

# ── 打印摘要 ──
print_summary() {
  echo ""
  log_info "═══════════════════════════════════════════════"
  log_info "  部署完成"
  log_info "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
  log_info "  日志: ${LOG_FILE}"
  log_info "═══════════════════════════════════════════════"
  echo ""
}

# ============================================================================
# 主入口
# ============================================================================

mkdir -p "$LOG_DIR"

clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       CampusKards 部署工具                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 运行环境检查
preflight_check

# ── 选择部署模式 ──
echo -e "${CYAN}请选择部署模式:${NC}"
echo "  1) 全量部署（前端 + 后端 + 迁移 + 重启）"
echo "  2) 仅部署后端（依赖安装 + 迁移）"
echo "  3) 仅部署前端（依赖安装 + 构建）"
echo "  4) 仅重启服务"
echo "  5) 仅运行数据库迁移"
echo "  6) 一键升级（非交互，自动完成全部步骤）"
echo "  7) 退出"
echo ""

read -r -p "$(echo -e "${YELLOW}?${NC} 输入编号 [1-7]: ")" mode
echo ""

case "$mode" in
  1)
    log_info "模式: 全量部署"
    read -r -p "$(echo -e "${YELLOW}?${NC} 分支名 [main]: ")" BRANCH
    BRANCH="${BRANCH:-main}"
    git_pull "$BRANCH"
    deploy_backend
    deploy_frontend
    restart_services "all"
    verify_deployment "all"
    print_summary
    ;;
  2)
    log_info "模式: 仅部署后端"
    if confirm "拉取最新代码?"; then
      read -r -p "$(echo -e "${YELLOW}?${NC} 分支名 [main]: ")" BRANCH
      git_pull "${BRANCH:-main}"
    fi
    deploy_backend
    if confirm "重启后端服务?"; then
      restart_services "backend"
    fi
    verify_deployment "backend"
    print_summary
    ;;
  3)
    log_info "模式: 仅部署前端"
    if confirm "拉取最新代码?"; then
      read -r -p "$(echo -e "${YELLOW}?${NC} 分支名 [main]: ")" BRANCH
      git_pull "${BRANCH:-main}"
    fi
    deploy_frontend
    if confirm "重启前端服务?"; then
      restart_services "frontend"
    fi
    verify_deployment "frontend"
    print_summary
    ;;
  4)
    log_info "模式: 仅重启服务"
    echo "请选择重启范围:"
    echo "  1) 全部服务"
    echo "  2) 仅后端"
    echo "  3) 仅前端"
    read -r -p "$(echo -e "${YELLOW}?${NC} 输入编号 [1-3]: ")" restart_scope
    case "$restart_scope" in
      1) restart_services "all"; verify_deployment "all" ;;
      2) restart_services "backend"; verify_deployment "backend" ;;
      3) restart_services "frontend"; verify_deployment "frontend" ;;
      *) error "无效选项"; exit 1 ;;
    esac
    print_summary
    ;;
  5)
    log_info "模式: 仅运行数据库迁移"
    detect_python_tool
    if confirm "迁移前备份数据库?"; then
      bash "${DEPLOY_SERVER_DIR}/backup.sh" 2>&1 | tee -a "$LOG_FILE" || log_warn "备份失败"
    fi
    check_and_migrate_database "${PROJECT_DIR}/backend" true
    if confirm "重启后端服务?"; then
      restart_services "backend"
    fi
    print_summary
    ;;
  6)
    log_info "模式: 一键升级（非交互）"
    read -r -p "$(echo -e "${YELLOW}?${NC} 分支名 [main]: ")" BRANCH
    BRANCH="${BRANCH:-main}"
    bash "${SCRIPT_DIR}/upgrade.sh" "$BRANCH"
    ;;
  7)
    log_info "部署已取消"
    exit 0
    ;;
  *)
    error "无效选项: $mode"
    exit 1
    ;;
esac
