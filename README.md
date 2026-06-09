# CampusKards — 校园卡牌对战

> 以校园生活为背景的策略卡牌对战游戏。五大学园势力，百种学生卡牌，实时在线对弈。

## 核心设定

| 兵种 | 映射 | 特点 |
|------|------|------|
| 步兵 | 学生 | 基础单位，数量多成本低 |
| 坦克 | 体育生 | 高生命低攻击，前排肉盾 |
| 火炮 | 学霸 | 远程高攻，后排输出 |
| 战斗机 | 纪检 | 快速突袭，对空对地 |
| 轰炸机 | 广播站 | 范围伤害，支援型 |

### 五大势力

| 势力 | 代码 | 风格 |
|------|------|------|
| 重点班 | `key_class` | 精锐高质量 |
| 艺体班 | `arts_class` | 灵活突击 |
| 普通班 | `normal_class` | 人海消耗 |
| 国际班 | `intl_class` | 均衡后期 |
| 竞赛班 | `competition_class` | 策略 combo |

### 卡牌类型

`unit`（生物）· `command`（指令）· `buff`（增益）· `counter`（反击）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 App Router · TypeScript · Tailwind · shadcn/ui · Framer Motion |
| 状态 | React Query + AuthContext（认证）· Zustand（游戏状态） |
| 后端 | FastAPI · Python 3.12 · SQLAlchemy 2.0 async · Pydantic v2 |
| 数据库 | PostgreSQL 16 · Alembic 迁移 |
| 缓存 | Redis 7（匹配队列/房间持久化） |

## 部署架构

```
用户 Browser
    │ HTTPS  前端域名
    ▼
前端服务器 (Next.js standalone :3000)
    │ HTTPS  API 域名
    ▼
后端服务器 (FastAPI :8000) ──► PostgreSQL ──► Redis
```

- 详细部署步骤见 [`deploy/README.md`](deploy/README.md)

## 目录结构

```
campuskards/
├── frontend/           # Next.js 应用
│   └── src/
│       ├── app/        # 路由（auth / game / admin）
│       ├── components/ # UI + 游戏组件
│       ├── lib/        # api.ts · auth-context · config
│       └── types/      # TypeScript 类型
├── backend/            # FastAPI 应用
│   └── app/
│       ├── api/        # 路由模块
│       ├── models/     # ORM
│       ├── schemas/    # Pydantic
│       ├── core/       # 配置 · 安全 · 数据库 · 游戏引擎
│       └── services/   # 业务逻辑（匹配/AI/房间管理）
├── deploy/             # 生产部署脚本 + systemd service
├── test/               # 测试 + 演示版前端
├── DEVELOPMENT.md      # 完整 API 规范 + 开发计划
├── BACKEND-GAP.md      # 前后端差异与 v1 限制跟踪
└── docs/               # 游戏设计文档
```

## 快速开始

### 后端

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -e .

cp ../.env.example .env    # 编辑 DATABASE_URL / SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd frontend
npm install

# 开发：API 默认同源，或设置：
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev    # → http://localhost:3000
```

## 环境变量

### 后端 (`.env`)

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL async 连接串 |
| `SECRET_KEY` | JWT 签名密钥（生产必须随机生成） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 访问令牌过期（默认 15 分钟） |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 刷新令牌过期（默认 7 天） |
| `CORS_ORIGINS` | JSON 数组，如 `["http://localhost:3000"]` |
| `ENVIRONMENT` | `development` 或 `production`（控制 Cookie Secure/SameSite） |
| `REDIS_URL` | Redis 连接串（匹配队列/房间需要） |

### 前端

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 后端地址；生产示例：`https://api.your-domain.com` |

## 安全机制

> 2025-06 安全加固已全部实施（P0-P2 共 17 项）

| 等级 | 防护措施 | 说明 |
|------|---------|------|
| 🛡️ **认证** | JWT 版本号撤销 | `token_version` 列，改密码/登出后旧 token 立即失效 |
| 🛡️ **认证** | 频率限制 (Redis) | 登录 5次/分，注册 3次/时，重置密码 3次/10分 |
| 🛡️ **认证** | 密码强度 | ≥8 位，必须包含字母+数字 |
| 🛡️ **防作弊** | `_require_current_player()` | 引擎层回合归属校验（防御纵深） |
| 🛡️ **防作弊** | 对局 `room.lock` | 双重检查防止并发结算 / 重复发奖 |
| 🛡️ **防作弊** | 选卡会话 Redis 存储 | 多 worker 下选卡不丢失 |
| 🛡️ **防作弊** | 管理员审计日志 | 所有管理员操作留痕 `admin_audit_logs` 表 |
| 🛡️ **防作弊** | 管理员得卡接口 | `POST /api/collection/{id}` 仅管理员可用 |
| 🛡️ **Web** | 安全响应头 | `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy` · `HSTS` |
| 🛡️ **Web** | 请求体大小限制 | 1MB 上限 |
| 🛡️ **WebSocket** | Token 不在 URL | 通过 `Sec-WebSocket-Protocol` header 传输，避免日志泄露 |
| 🛡️ **Session** | `/set-cookie` 持有者证明 | 仅当前用户可设置自己的 Cookie |

## API 概览

> 完整规范见 [`DEVELOPMENT.md`](DEVELOPMENT.md) 第四章

| 模块 | 端点 | 说明 |
|------|------|------|
| Auth | `POST /api/auth/{register,login,refresh,logout,set-cookie}` | 认证 |
| Auth | `GET /api/auth/me` | 当前用户（含 `role`, `avatar_url`） |
| Cards | `GET /api/cards` | 分页卡牌列表 |
| Collection | `GET /api/collection` | 我的收藏 |
| Collection | `POST /api/collection/{id}/upgrade` | 升级卡牌 |
| Collection | `POST /api/collection/{id}` | 添加卡牌（管理员专用） |
| Decks | `GET/POST /api/decks` | 卡组 CRUD（30 张校验） |
| Shop | `GET /api/shop/packs` · `POST .../open` | 卡包商店 |
| Shop | `POST /api/shop/packs/selector/{finalize,reroll}` | 选卡包（Redis 会话） |
| Checkin | `GET /api/checkin/status` · `POST /api/checkin` | 每日签到 |
| User | `GET /api/user/profile` · `PUT /api/user/avatar` | 资料与头像 |
| Announcements | `GET /api/announcements` | 公告（只读） |
| Admin | `GET /api/admin/stats` | `{ users, cards, announcements, total_ink }` |
| Admin | `GET/PATCH /api/admin/users/{id}` | 用户管理 |
| Admin | `*/api/admin/announcements` | 公告 CRUD + pin |
| Admin | `POST /api/admin/cards/reseed` | 卡牌数据重载 |
| Admin | `POST /api/admin/users/{id}/reset-key` | 设置用户重置密钥 |
| Admin | `POST /api/collection/{id}` | 管理员添加卡牌 |
| Leaderboard | `GET /api/leaderboard` | ELO 排行 |
| **Match** | `POST /api/match/queue` | 加入匹配队列 |
| **Match** | `POST /api/match/pve` | 单人练习（对战 AI） |
| **Match** | `DELETE /api/match/queue` | 取消匹配 |
| **Match** | `GET /api/match/queue/status` | 查询匹配状态 |
| **Match** | `GET /api/match/history` | 对战历史 |
| **Match** | `GET /api/match/{id}` | 对战详情 |
| **Match** | `POST /api/match/{id}/surrender` | 投降 |
| **Game WS** | `ws://host/ws/game/{match_id}` | 实时对战 WebSocket（Token 通过 Subprotocol） |

## 对战功能状态

- ✅ **快速匹配**：休闲对战，AI 自动补位（15秒无人则匹配 AI）
- ✅ **排位赛**：竞技对战，影响 ELO 分数
- ✅ **PVE 练习**：单人挑战 AI（4 级难度：简单/中等/困难/大师）
- ✅ **AI 难度自适应**：根据玩家 ELO 自动调整 AI 实力
- ✅ **游戏引擎**：五派系协同/被动、抉择系统、反制陷阱、关键词完整
- ✅ **WebSocket 实时同步**：全量状态 + 回合计时 + 超时处理

## 认证说明

- 主认证：`Authorization: Bearer <access_token>`（localStorage）
- 辅助：httpOnly Cookie `campuskards_token`（供 middleware 登录页重定向）
- 刷新：`campuskards_refresh_token` Cookie（自动刷新）
- WebSocket：Token 通过 `Sec-WebSocket-Protocol` 子协议头发送（**不在 URL 中**）
- ⚠️ 安全特性：
  - JWT 携带 `token_version`，改密码/登出后旧令牌立即失效
  - 频率限制：登录 5次/IP/min · 注册 3次/IP/h · 重置密码 3次/IP/10min
  - 密码强度：≥8 位，至少包含一个字母和一个数字
  - `/set-cookie` 需持有者证明（仅当前用户可设置自己的 Cookie）

## 开发文档索引

| 文档 | 内容 |
|------|------|
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | API 规范 · 架构决策 · Bug 清单 · 部署 |
| [`BACKEND-GAP.md`](BACKEND-GAP.md) | API 差异与对战 v1 限制 |
| [`docs/upgrade-system-design.md`](docs/upgrade-system-design.md) | 卡牌升级系统 |
| [`docs/faction-synergy-design.md`](docs/faction-synergy-design.md) | 派系协同 |
| [`docs/battlefield-depth-design.md`](docs/battlefield-depth-design.md) | 战场机制 |
| [`deploy/`](deploy/) | 部署脚本 + systemd 配置 + 运维文档 |

---

*CampusKards — 课间十分钟，来一局！*
