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
| 缓存 | Redis 7（预留，待接入匹配队列） |

## 部署架构

```
用户 Browser
    │ HTTPS  campuskards.xiaobocloud.fun
    ▼
Azure Tokyo VPS (Next.js :3001)
    │ HTTPS  gapi.xiaobocloud.fun
    ▼
XiaoBo Server (FastAPI :8100) ──► PostgreSQL
```

- 前端：`campuskards.xiaobocloud.fun`
- API：`gapi.xiaobocloud.fun`
- 详细部署步骤见 `DEVELOPMENT.md` 第八章

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
│       └── core/       # 配置 · 安全 · 数据库
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
uvicorn app.main:app --reload --host 127.0.0.1 --port 8100
```

### 前端

```bash
cd frontend
npm install

# 开发：API 默认同源，或设置：
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8100
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

### 前端

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 后端地址；生产：`https://gapi.xiaobocloud.fun` |

## API 概览

> 完整规范见 [`DEVELOPMENT.md`](DEVELOPMENT.md) 第四章

| 模块 | 端点 | 说明 |
|------|------|------|
| Auth | `POST /api/auth/{register,login,refresh,logout,set-cookie}` | 认证 |
| Auth | `GET /api/auth/me` | 当前用户（含 `role`, `avatar_url`） |
| Cards | `GET /api/cards` | 分页卡牌列表 |
| Collection | `GET /api/collection` | 我的收藏 |
| Collection | `POST /api/collection/{id}/upgrade` | 升级卡牌 |
| Decks | `GET/POST /api/decks` | 卡组 CRUD（30 张校验） |
| Shop | `GET /api/shop/packs` · `POST .../open` | 卡包商店 |
| Checkin | `GET /api/checkin/status` · `POST /api/checkin` | 每日签到 |
| User | `GET /api/user/profile` · `PUT /api/user/avatar` | 资料与头像 |
| Announcements | `GET /api/announcements` | 公告（只读） |
| Admin | `GET /api/admin/stats` | `{ users, cards, announcements, total_ink }` |
| Admin | `GET/PATCH /api/admin/users/{id}` | 用户管理 |
| Admin | `*/api/admin/announcements` | 公告 CRUD + pin |
| Leaderboard | `GET /api/leaderboard` | ELO 排行 |
| **Match** | `POST /api/match/queue` 等 | ✅ v1 |
| **Game WS** | `ws://host/ws/game/{match_id}` | ✅ v1 |
| **Game WS** | `wss://.../ws/game/{id}` | **待实现** |

## 认证说明

- 主认证：`Authorization: Bearer <access_token>`（localStorage）
- 辅助：httpOnly Cookie `campuskards_token`（供 middleware 登录页重定向）
- 登录后前端显式调用 `POST /api/auth/set-cookie` 写入 Cookie
- `/game/*` 路由保护由客户端 `AuthGuard` 完成（非 middleware）

## 开发文档索引

| 文档 | 内容 |
|------|------|
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | API 规范 · 架构决策 · Bug 清单 · 部署 |
| [`BACKEND-GAP.md`](BACKEND-GAP.md) | API 差异与对战 v1 限制 |
| [`docs/upgrade-system-design.md`](docs/upgrade-system-design.md) | 卡牌升级系统 |
| [`docs/faction-synergy-design.md`](docs/faction-synergy-design.md) | 派系协同 |
| [`docs/battlefield-depth-design.md`](docs/battlefield-depth-design.md) | 战场机制 |

---

*CampusKards — 课间十分钟，来一局！*
