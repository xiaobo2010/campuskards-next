#!/usr/bin/env bash
# ============================================================================
# CampusKards 前端独立部署脚本
# 可独立执行：依赖安装 → 构建 → 服务重启
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/frontend_${TIMESTAMP}.log"

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
echo -e "${CYAN}║     CampusKards 前端部署                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 阶段 1: 环境检查 ──
echo -e "${CYAN}────────────────── 1/5  环境检查 ──────────────────${NC}"

for cmd in git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    error "缺少命令: $cmd"
    exit 1
  fi
done

NODE_VER=$(node --version 2>/dev/null | sed 's/v//')
info "Node.js: $NODE_VER"
NPM_VER=$(npm --version 2>/dev/null)
info "npm: $NPM_VER"

NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  warn "推荐 Node.js >= 18，当前为 $NODE_VER"
  confirm "继续?" || exit 0
fi

# Git 状态
if git -C "$PROJECT_DIR" status --porcelain | grep -q .; then
  warn "工作区有未提交的更改:"
  git -C "$PROJECT_DIR" status --short
  confirm "继续?" || exit 0
fi

# 磁盘空间（构建需要额外空间）
avail=$(df --output=avail "$PROJECT_DIR" 2>/dev/null | tail -1)
if [[ -n "$avail" && "$avail" -lt 524288 ]]; then
  warn "磁盘空间不足 512MB（剩余约 $((avail / 1024)) MB）"
  confirm "继续?" "n" || exit 0
fi
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

# ── 阶段 3: 安装依赖 ──
echo -e "${CYAN}────────────────── 3/5  安装 Node 依赖 ────────────${NC}"
FRONTEND_DIR="${PROJECT_DIR}/frontend"
cd "$FRONTEND_DIR"

# 缓存清理（可选）
if confirm "清理 node_modules 缓存后安装?" "n"; then
  log_info "清理 node_modules..."
  rm -rf node_modules .next
  log_info "全新安装 (npm install)..."
  npm install 2>&1 | tee -a "$LOG_FILE"
else
  log_info "增量安装 (npm ci)..."
  npm ci 2>&1 | tee -a "$LOG_FILE"
fi
log_ok "Node 依赖安装完成"
echo ""

# ── 阶段 4: 构建 ──
echo -e "${CYAN}────────────────── 4/5  构建 ──────────────────────${NC}"

# 环境变量提示
if [[ -z "${NEXT_PUBLIC_API_URL:-}" ]]; then
  info "NEXT_PUBLIC_API_URL 未设置，使用 next.config.js 中的 BACKEND_URL 默认值"
  if confirm "设置生产环境 API URL?"; then
    read -r -p "$(echo -e "${YELLOW}?${NC} API URL [https://gapi.xiaobocloud.fun]: ")" api_url
    export NEXT_PUBLIC_API_URL="${api_url:-https://gapi.xiaobocloud.fun}"
  fi
fi

log_info "构建中 (npm run build)..."
npm run build 2>&1 | tee -a "$LOG_FILE"
log_ok "构建完成"

# 检查构建产物
if [[ -d ".next" ]]; then
  local build_size
  build_size=$(du -sh .next 2>/dev/null | cut -f1)
  log_ok "构建产物: .next/ (${build_size})"
else
  log_error "构建产物 .next/ 不存在，构建可能失败"
  exit 1
fi

cd "$PROJECT_DIR"
echo ""

# ── 阶段 5: 重启服务 ──
echo -e "${CYAN}────────────────── 5/5  重启服务 ──────────────────${NC}"
if confirm "重启前端服务 (campuskards-frontend)?"; then
  sudo systemctl daemon-reload
  sudo systemctl restart campuskards-frontend
  sleep 3
  if sudo systemctl is-active --quiet campuskards-frontend; then
    log_ok "前端服务 运行中"
    sudo systemctl status campuskards-frontend --no-pager -l | head -3
  else
    log_error "前端服务 启动失败，查看日志: journalctl -u campuskards-frontend -n 50"
  fi

  # HTTP 健康检查
  local frontend_port
  frontend_port=$(grep -oP '--port \K\d+' "${SCRIPT_DIR}/xiaoboserver/campuskards-frontend.service" 2>/dev/null || echo "3000")
  if command -v curl &>/dev/null; then
    sleep 2
    if curl -sfo /dev/null "http://127.0.0.1:${frontend_port}/" 2>/dev/null; then
      log_ok "HTTP 响应正常 (port ${frontend_port})"
    else
      log_warn "HTTP 无响应（可能在 nginx 反代后）"
    fi
  fi
fi
echo ""

# ── 完成 ──
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  前端部署完成${NC}"
echo -e "${GREEN}  时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${GREEN}  日志: ${LOG_FILE}${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
