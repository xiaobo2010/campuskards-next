# CampusKards 部署文档

## 目录结构

```
deploy/
├── deploy.sh              # 交互式部署总控（菜单选择）
├── deploy-backend.sh      # 后端独立部署
├── deploy-frontend.sh     # 前端独立部署
├── rollback.sh            # 回滚工具（代码/数据库）
├── lib/
│   └── common.sh          # 共享工具（uv/pip 检测、迁移检查、standalone 复制）
├── server/                # 后端服务器配置（systemd、环境变量、备份）
│   ├── .env.example
│   ├── backup.sh
│   ├── install-services.sh
│   ├── campuskards-backend.service.example
│   ├── campuskards-frontend.service.example
│   └── deploy.sh          # 非交互一键部署（CI/cron）
└── logs/                  # 部署日志（自动生成）
```

## 首次部署（后端服务器）

```bash
# 1. 克隆代码到目标目录，例如 /opt/campuskards
git clone <repo-url> /opt/campuskards
cd /opt/campuskards

# 2. 配置环境变量
cp deploy/server/.env.example deploy/server/.env
# 编辑 deploy/server/.env：数据库密码、SECRET_KEY、CORS_ORIGINS 等

# 3. 安装 systemd 服务（自动替换 __PROJECT_ROOT__ 为当前项目路径）
sudo bash deploy/server/install-services.sh

# 4. 交互式全量部署
sudo bash deploy/deploy.sh
```

## 使用方式

### 交互式总控（推荐）

```bash
sudo bash deploy/deploy.sh
```

提供 6 种模式：

1. **全量部署** — 拉代码 → 后端依赖 → 前端构建 → 迁移 → 重启
2. **仅后端** — 拉代码 → 依赖 → 迁移 → （可选）重启
3. **仅前端** — 拉代码 → 依赖 → 构建 → standalone 复制 → （可选）重启
4. **仅重启服务** — 重启前/后端 systemd 服务
5. **仅迁移** — 数据库备份 + 版本检查 + alembic upgrade
6. **退出**

### 独立部署

```bash
# 后端（交互式，每步可确认/跳过）
sudo bash deploy/deploy-backend.sh

# 前端（交互式，可清理缓存/选择分支）
sudo bash deploy/deploy-frontend.sh
```

### 回滚

```bash
sudo bash deploy/rollback.sh
```

支持：

- 回滚代码到指定 Git 提交
- 回滚代码 + 数据库迁移降级
- 仅回滚数据库迁移

## Python 依赖：uv 与 pip

部署脚本会自动检测包管理器：

| 环境 | 行为 |
|------|------|
| 已安装 `uv` | 使用 `uv venv` + `uv sync --no-dev` + `uv run alembic` |
| 仅 `pip` | 使用 `python3 -m venv` + `pip install -e .` + `alembic` |

若服务器无 `uv`，脚本会给出安装提示并自动回退到 `pip`，功能等价。

```bash
# 可选：安装 uv（推荐）
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 数据库迁移与版本兼容

从旧版手动建库升级时，`alembic_version` 表可能为空或与当前迁移链不匹配。部署脚本在 `upgrade head` 前会：

1. 执行 `alembic current` 查看当前版本
2. 若版本为空但 `users` 等表已存在 → 提示交互式 **stamp**
3. 若版本不在迁移历史中 → 提示重新 stamp
4. 确认后执行 `alembic upgrade head`

### 手动 stamp（旧数据库首次迁移）

```bash
cd backend
source .venv/bin/activate

# 查看迁移历史，选择与实际 schema 匹配的版本
alembic history

# 示例：数据库仅有初始 schema
alembic stamp f697305bb47d

# 示例：数据库已含升级系统字段
alembic stamp 002_upgrade_system

# 再执行升级
alembic upgrade head
```

### 迁移链（当前）

```
f697305bb47d (initial)
  → 3c1a47e80688 (announcements + user_role)
  → a1b2c3d4e5f6 (reset_key + ink)
  → b4c5d6e7f8a9 (match_mode_replay)
  → 002_upgrade_system (avatar_url + level/fragments)
  → c5d6e7f8a9b0 (fix_columns_add_fks)
  → d6e7f8a9b0c1 (token_version + newbie_claimed)
  → 085f04087e35 (widen_faction_columns)
  → e8f9a0b1c2d3 (admin_audit_logs)
  → 3690c463404a (user_checkins)
  → a1b2d3e4f5a6 (story_tables)
  → fc459ca2775f (performance_indexes, HEAD)
```

## Next.js Standalone 模式

`frontend/next.config.js` 已启用 `output: "standalone"`。构建后 Next.js 生成精简的运行时目录，但**不会自动包含**静态资源，需手动复制：

```bash
cd frontend

# 构建
npm ci && npm run build

# 复制静态资源（部署脚本会自动执行此步骤）
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public      # 含 public/audio/ 音频文件
```

### systemd 运行 standalone

`campuskards-frontend.service.example` 配置为：

- `WorkingDirectory` → `frontend/.next/standalone`
- `ExecStart` → `node frontend/.next/standalone/server.js`
- `NEXT_PUBLIC_API_URL` → 在 service 文件或构建时设置

每次 `npm run build` 后都必须重新复制 `static/` 和 `public/`，否则页面样式/图片/音频会 404。`deploy-frontend.sh` 和 `deploy.sh` 已内置 `copy_standalone_assets` 步骤。

### 与 `next start` 的区别

| 方式 | 命令 | 静态资源 |
|------|------|----------|
| `next start` | 在 `frontend/` 目录运行 | 自动读取 `.next/static` |
| **standalone** | 运行 `.next/standalone/server.js` | 需复制 `static/` 和 `public/` |

生产环境推荐 standalone（体积更小、依赖更少）。

## 部署流程

```
预检 → Git Pull → 依赖安装 → 构建/迁移 → standalone 复制 → 重启 → 验证
```

- 预检：检查命令/版本/磁盘/uv 或 pip/未提交更改
- 每步可交互确认/跳过
- 自动记录日志到 `deploy/logs/`

## 数据库备份

```bash
bash deploy/server/backup.sh
```

备份文件保存在 `deploy/server/backups/`，默认保留 7 天。
