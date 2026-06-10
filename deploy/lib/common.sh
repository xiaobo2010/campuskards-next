#!/usr/bin/env bash
# ============================================================================
# CampusKards 部署共享工具库
# 被 deploy.sh / deploy-backend.sh / deploy-frontend.sh / rollback.sh source
# ============================================================================

# 生产配置目录（systemd、.env、备份脚本）— 基于本文件位置，不依赖调用方 SCRIPT_DIR
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_DEPLOY_ROOT="$(dirname "$_LIB_DIR")"
DEPLOY_SERVER_DIR="${DEPLOY_SERVER_DIR:-${_DEPLOY_ROOT}/server}"

# Python 包管理器：uv 或 pip
PYTHON_TOOL=""

# ── 检测 uv，无则回退 pip ──
detect_python_tool() {
  if command -v uv &>/dev/null; then
    PYTHON_TOOL="uv"
    _log_ok "检测到 uv ($(uv --version 2>/dev/null | head -1))"
    return 0
  fi

  if command -v pip3 &>/dev/null; then
    PYTHON_TOOL="pip"
  elif command -v pip &>/dev/null; then
    PYTHON_TOOL="pip"
  else
    _log_error "未找到 uv 或 pip，请先安装 Python 包管理器"
    _log_info "安装 uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    _log_info "或使用系统 pip: apt install python3-pip / yum install python3-pip"
    return 1
  fi

  _log_warn "未检测到 uv，将使用 pip 安装依赖（功能等价，速度较慢）"
  _log_info "建议安装 uv 以获得更快依赖同步: curl -LsSf https://astral.sh/uv/install.sh | sh"
  return 0
}

# ── 创建并激活虚拟环境 ──
setup_venv() {
  local backend_dir="$1"
  cd "$backend_dir"

  if [[ ! -d ".venv" ]]; then
    _log_info "创建 Python 虚拟环境..."
    if [[ "$PYTHON_TOOL" == "uv" ]]; then
      uv venv
    else
      python3 -m venv .venv
    fi
  fi

  # shellcheck disable=SC1091
  source .venv/bin/activate
}

# ── 安装后端依赖 ──
install_backend_deps() {
  local backend_dir="$1"
  cd "$backend_dir"
  # shellcheck disable=SC1091
  source .venv/bin/activate

  if [[ "$PYTHON_TOOL" == "uv" ]]; then
    _log_info "同步依赖 (uv sync --no-dev)..."
    uv sync --no-dev
  else
    _log_info "安装依赖 (pip install -e .)..."
    pip install --upgrade pip
    pip install -e .
  fi
}

# ── 运行 alembic 命令 ──
run_alembic() {
  local backend_dir="$1"
  shift
  cd "$backend_dir"
  # shellcheck disable=SC1091
  source .venv/bin/activate

  if [[ "$PYTHON_TOOL" == "uv" ]]; then
    uv run alembic "$@"
  else
    alembic "$@"
  fi
}

# ── 从 alembic current 输出提取 revision ID ──
_alembic_extract_rev() {
  # 匹配 12 位十六进制 revision 或 002_upgrade_system 这类命名 revision
  echo "$1" | grep -oE '[a-f0-9]{12}|[0-9]{3}_[a-z_]+' | head -1 || true
}

# ── 检查数据库是否已有业务表（无 alembic 版本时的旧库判断）──
_db_has_application_tables() {
  local backend_dir="$1"
  local env_file="${DEPLOY_SERVER_DIR}/.env"

  if [[ ! -f "$env_file" ]]; then
    return 1
  fi

  # shellcheck disable=SC1090
  set -a; source "$env_file"; set +a

  local db_user="${DB_USER:-ck}"
  local db_name
  db_name=$(echo "${DATABASE_URL:-}" | grep -oP '(?<=/)\w+$' || echo "campuskards")

  if ! command -v psql &>/dev/null; then
    return 1
  fi

  local table_count
  table_count=$(PGPASSWORD="${DB_PASSWORD:-}" psql -U "$db_user" -h localhost -d "$db_name" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users';" \
    2>/dev/null || echo "0")

  [[ "${table_count// /}" -gt 0 ]]
}

# ── 迁移前版本兼容性检查，必要时交互式 stamp ──
check_and_migrate_database() {
  local backend_dir="$1"
  local interactive="${2:-true}"

  _log_info "检查数据库迁移版本..."

  local current_output head_output
  current_output=$(run_alembic "$backend_dir" current 2>&1) || true
  echo "$current_output" | tee -a "${LOG_FILE:-/dev/stdout}"

  head_output=$(run_alembic "$backend_dir" heads 2>&1) || true
  local head_rev
  head_rev=$(_alembic_extract_rev "$head_output")

  local cur_rev
  cur_rev=$(_alembic_extract_rev "$current_output")

  if [[ -z "$cur_rev" ]]; then
    if _db_has_application_tables "$backend_dir"; then
      _log_warn "数据库已有表结构，但 alembic_version 未记录版本（常见于旧版手动建库）"
      _log_info "迁移历史:"
      run_alembic "$backend_dir" history 2>&1 | tee -a "${LOG_FILE:-/dev/stdout}"
      echo ""
      _log_info "请根据实际 schema 选择应 stamp 到的版本，再执行 upgrade"
      _log_info "示例: alembic stamp f697305bb47d  # 仅初始 schema"
      _log_info "      alembic stamp 002_upgrade_system  # 含升级系统字段"

      if [[ "$interactive" == "true" ]]; then
        local stamp_rev
        read -r -p "$(echo -e "${_YELLOW}?${_NC} 输入 stamp 版本 (留空取消): ")" stamp_rev
        if [[ -z "$stamp_rev" ]]; then
          _log_error "未 stamp 版本，跳过迁移。请手动执行: cd backend && alembic stamp <revision>"
          return 1
        fi
        _log_info "执行 alembic stamp ${stamp_rev}..."
        run_alembic "$backend_dir" stamp "$stamp_rev" 2>&1 | tee -a "${LOG_FILE:-/dev/stdout}"
      else
        _log_error "非交互模式下无法自动 stamp，请先手动标记版本"
        return 1
      fi
    else
      _log_info "空数据库，将从头执行全部迁移"
    fi
  else
    # 检查当前版本是否在迁移链中
    local history_output
    history_output=$(run_alembic "$backend_dir" history 2>&1) || true
    if ! echo "$history_output" | grep -q "$cur_rev"; then
      _log_warn "当前版本 ${cur_rev} 不在迁移历史中，upgrade 可能失败"
      _log_info "可用版本:"
      echo "$history_output" | tee -a "${LOG_FILE:-/dev/stdout}"

      if [[ "$interactive" == "true" ]]; then
        local stamp_rev
        read -r -p "$(echo -e "${_YELLOW}?${_NC} 输入正确的 stamp 版本 (留空=尝试直接 upgrade): ")" stamp_rev
        if [[ -n "$stamp_rev" ]]; then
          _log_info "重新 stamp 到 ${stamp_rev}..."
          run_alembic "$backend_dir" stamp "$stamp_rev" 2>&1 | tee -a "${LOG_FILE:-/dev/stdout}"
        fi
      fi
    elif [[ -n "$head_rev" && "$cur_rev" == "$head_rev" ]]; then
      _log_ok "数据库已在最新版本 (${cur_rev})"
      return 0
    else
      _log_info "当前版本: ${cur_rev} → 目标: ${head_rev:-head}"
    fi
  fi

  _log_info "执行 alembic upgrade head..."
  run_alembic "$backend_dir" upgrade head 2>&1 | tee -a "${LOG_FILE:-/dev/stdout}"
  _log_ok "数据库迁移完成"
}

# ── Next.js standalone：复制 static 与 public ──
copy_standalone_assets() {
  local frontend_dir="$1"
  cd "$frontend_dir"

  if [[ ! -d ".next/standalone" ]]; then
    _log_warn "未找到 .next/standalone/，跳过静态资源复制（可能未启用 output:standalone）"
    return 0
  fi

  # ── 检查构建 ID 是否匹配，处理过期缓存 ──
  local main_build_id standalone_build_id
  main_build_id=""
  standalone_build_id=""
  if [[ -f ".next/BUILD_ID" ]]; then
    main_build_id=$(cat ".next/BUILD_ID")
  fi
  if [[ -f ".next/standalone/.next/BUILD_ID" ]]; then
    standalone_build_id=$(cat ".next/standalone/.next/BUILD_ID")
  fi

  if [[ -n "$main_build_id" && "$main_build_id" != "$standalone_build_id" ]]; then
    _log_warn "构建 ID 不匹配 (main: ${main_build_id}, standalone: ${standalone_build_id:-无})"
    _log_info "清理旧 standalone 静态资源..."
    rm -rf .next/standalone/.next/static .next/standalone/public
  fi

  _log_info "复制 standalone 静态资源 (.next/static → .next/standalone/.next/static)..."
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static

  if [[ -d "public" ]]; then
    _log_info "复制 public/ → .next/standalone/public/"
    cp -r public .next/standalone/public
  fi

  # ── 构建验证 ──
  local static_dir="${frontend_dir}/.next/standalone/.next/static"
  local missing=0

  if [[ ! -d "${static_dir}/chunks" ]]; then
    _log_error "standalone 缺少 chunks/ 目录，JS 资源将 404！"
    missing=999
  else
    local js_count
    js_count=$(find "${static_dir}/chunks" -name '*.js' 2>/dev/null | wc -l)
    if [[ "$js_count" -eq 0 ]]; then
      _log_error "standalone chunks/ 中无 JS 文件，构建可能不完整"
      missing=998
    else
      _log_ok "standalone 验证通过 (${js_count} JS chunks, BUILD_ID=${main_build_id:-?})"
    fi
  fi

  # 同时检查 public 资产
  if [[ -d ".next/standalone/public" ]]; then
    local pub_count
    pub_count=$(find ".next/standalone/public" -type f 2>/dev/null | wc -l)
    _log_info "public/ 资产: ${pub_count} 个文件"
  fi

  return $([[ $missing -eq 0 ]] && echo 0 || echo 1)
}

# ── 从 service 文件读取前端端口 ──
get_frontend_port() {
  local service_file=""
  for candidate in \
    "${DEPLOY_SERVER_DIR}/campuskards-frontend.service" \
    "${DEPLOY_SERVER_DIR}/campuskards-frontend.service.example"; do
    if [[ -f "$candidate" ]]; then
      service_file="$candidate"
      break
    fi
  done

  if [[ -z "$service_file" ]]; then
    echo "3000"
    return
  fi

  local port
  port=$(grep -oP 'Environment=PORT=\K\d+' "$service_file" 2>/dev/null || true)
  if [[ -n "$port" ]]; then
    echo "$port"
    return
  fi
  port=$(grep -oP '--port \K\d+' "$service_file" 2>/dev/null || true)
  echo "${port:-3000}"
}

# ── 日志辅助（调用方需定义 log 函数后可覆盖）──
_RED='\033[0;31m'; _GREEN='\033[0;32m'; _YELLOW='\033[1;33m'; _CYAN='\033[0;36m'; _NC='\033[0m'

_log_info()  { if declare -f log_info &>/dev/null; then log_info "$@"; else echo -e "${_CYAN}[INFO]${_NC}  $*"; fi; }
_log_ok()    { if declare -f log_ok &>/dev/null; then log_ok "$@"; else echo -e "${_GREEN}[OK]${_NC}    $*"; fi; }
_log_warn()  { if declare -f log_warn &>/dev/null; then log_warn "$@"; else echo -e "${_YELLOW}[WARN]${_NC}  $*"; fi; }
_log_error() { if declare -f log_error &>/dev/null; then log_error "$@"; else echo -e "${_RED}[ERROR]${_NC} $*"; fi; }
