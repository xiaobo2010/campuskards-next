# CampusKards 后端开发计划

## 已完成功能

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ✅ | 注册/登录/登出/JWT/httpOnly cookie |
| 卡牌 CRUD | ✅ | 管理员增删改，分页+筛选查询 |
| 公告系统 | ✅ | 管理员 CRUD，公开查询 |
| 用户管理 | ✅ | 管理员列表/角色/启用禁用 |
| 卡牌收藏 | ✅ | 添加/查看收藏 |
| 卡组系统 | ✅ | CRUD + 卡组内卡牌管理 |
| 分页格式 | ✅ | 统一 `{items, total, page, page_size}` |
| UUID 序列化 | ✅ | Pydantic v2 `@field_serializer` |

## 后端架构设计

### 分层架构

```
Router (路由层)           → HTTP 请求解析、参数校验、响应序列化
    ↓
Service (业务逻辑层)       → 业务规则、权限校验、事务编排
    ↓
Repository (数据访问层)    → SQL 查询封装、ORM 操作
    ↓
Model (模型层)            → SQLAlchemy ORM + Alembic 迁移
```

### 当前目录结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI app 实例 + 中间件 + 路由注册
│   │
│   ├── core/
│   │   ├── config.py          # Pydantic Settings 配置加载
│   │   ├── security.py        # JWT 签发/验证、密码哈希
│   │   ├── database.py        # async engine + session factory
│   │   ├── dependencies.py    # FastAPI 依赖注入 (get_current_user, get_db)
│   │   └── redis.py           # Redis 连接池
│   │
│   ├── routers/               # 路由层 — 只做请求/响应转换
│   │   ├── auth.py            # /api/auth/* 注册登录
│   │   ├── cards.py           # /api/cards/* 卡牌 CRUD
│   │   ├── collection.py      # /api/collection/* 收藏
│   │   ├── decks.py           # /api/decks/* 卡组
│   │   ├── announcements.py   # /api/announcements/* 公告
│   │   └── admin.py           # /api/admin/* 管理接口
│   │
│   ├── services/              # 业务逻辑层
│   │   ├── auth_service.py    # 注册验证、Token 管理
│   │   ├── card_service.py    # 卡牌业务规则
│   │   ├── collection_service.py
│   │   ├── deck_service.py
│   │   └── admin_service.py
│   │
│   ├── repositories/          # 数据访问层
│   │   ├── user_repo.py       # User 查询
│   │   ├── card_repo.py       # Card 查询
│   │   ├── collection_repo.py
│   │   ├── deck_repo.py
│   │   └── announcement_repo.py
│   │
│   ├── models/                # SQLAlchemy ORM
│   │   ├── __init__.py        # Base 注册表
│   │   ├── user.py            # User model
│   │   ├── card.py            # Card model
│   │   ├── collection.py      # Collection model
│   │   ├── deck.py            # Deck + DeckCard model
│   │   └── announcement.py    # Announcement model
│   │
│   ├── schemas/               # Pydantic v2 请求/响应 Schema
│   │   ├── user.py
│   │   ├── card.py
│   │   ├── collection.py
│   │   ├── deck.py
│   │   ├── announcement.py
│   │   └── common.py          # PaginatedResponse 等公共 schema
│   │
│   └── middleware/
│       └── auth_middleware.py  # Cookie 辅助中间件
│
├── alembic/                   # 数据库迁移
│   ├── env.py
│   └── versions/
├── alembic.ini
└── requirements.txt
```

### 数据库模型关系

```
┌──────────────┐         ┌──────────────┐
│     User     │         │     Card     │
├──────────────┤         ├──────────────┤
│ id (UUID PK) │         │ id (UUID PK) │
│ username     │         │ name         │
│ email        │         │ faction      │
│ hashed_pw    │         │ unit_type    │
│ role         │         │ attack       │
│ is_active    │         │ health       │
│ created_at   │         │ cost         │
│ updated_at   │         │ rarity       │
└──────┬───────┘         │ effect_code  │
       │                 │ description  │
       │                 │ created_by ──┼──► User.id
       │                 └──────┬───────┘
       │                        │
       │  ┌─────────────────────┼──────────────────┐
       │  │                     │                  │
       ▼  │                     ▼                  ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Collection    │   │     Deck        │   │  Announcement   │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ id (UUID PK)    │   │ id (UUID PK)    │   │ id (UUID PK)    │
│ user_id ────────┤   │ user_id ────────┤   │ title           │
│ card_id ────────┤   │ name            │   │ content         │
│ quantity        │   │ description     │   │ is_active       │
│ acquired_at     │   │ is_public       │   │ created_by ─────┤
│                 │   │ created_at      │   │ created_at      │
│ UNIQUE(user,    │   │ updated_at      │   │ updated_at      │
│        card)    │   └────────┬────────┘   └─────────────────┘
└─────────────────┘            │
                               │
                               ▼
                      ┌─────────────────┐
                      │    DeckCard     │
                      ├─────────────────┤
                      │ id (UUID PK)    │
                      │ deck_id ────────┤
                      │ card_id ────────┤
                      │ quantity        │
                      │                 │
                      │ UNIQUE(deck,    │
                      │        card)    │
                      └─────────────────┘
```

**关系说明:**
- User 1:N Collection（一个用户多个收藏）
- User 1:N Deck（一个用户多个卡组）
- Card 1:N Collection（一张卡被多人收藏）
- Deck N:M Card（通过 DeckCard 关联）
- User 1:N Announcement（管理员发布公告）

## 部署方案

### systemd service（systemctl --user）

#### campuscards-backend.service

```ini
[Unit]
Description=CampusKards Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=/ssd/7a40/campuskards/backend
ExecStart=/ssd/7a40/campuskards/backend/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8100 \
    --log-level info
Restart=always
RestartSec=5
EnvironmentFile=/ssd/7a40/campuskards/backend/.env

[Install]
WantedBy=default.target
```

#### 常用命令

```bash
# 启停
systemctl --user start campuscards-backend.service
systemctl --user stop campuscards-backend.service
systemctl --user restart campuscards-backend.service
systemctl --user enable campuscards-backend.service   # 开机自启

# 查看状态
systemctl --user status campuscards-backend.service

# 查看日志
journalctl --user -u campuscards-backend.service -f          # 实时跟踪
journalctl --user -u campuscards-backend.service --since today  # 今日日志
journalctl --user -u campuscards-backend.service -n 100      # 最近100行
```

### 更新部署流程

```bash
# === 在开发机上 ===

# 1. 推送代码到 Git（备份）
git add . && git commit -m "feat: xxx" && git push

# 2. scp 到 XiaoBo Server（XiaoBo 无法访问 GitHub）
scp -r backend/ xiaobo2010@yd.frp-shy.com -P 18185:/ssd/7a40/campuskards/

# === SSH 到 XiaoBo Server ===
ssh xiaobo2010@yd.frp-shy.com -p 18185

cd /ssd/7a40/campuskards/backend
source venv/bin/activate

# 3. 安装新依赖（如有）
pip install -r requirements.txt

# 4. 运行数据库迁移（如有）
alembic upgrade head

# 5. 重启服务
systemctl --user restart campuscards-backend.service

# 6. 验证
systemctl --user status campuscards-backend.service
curl -s http://127.0.0.1:8100/api/health | python3 -m json.tool
```

## 后续开发路线图

### Phase 2: 游戏引擎核心

**目标**: 构建卡牌对战核心引擎

```
app/
├── game/
│   ├── engine.py          # GameEngine — 回合状态机
│   ├── battlefield.py     # Battlefield — 棋盘格子管理
│   ├── combat.py          # CombatResolver — 战斗结算
│   ├── turn_manager.py    # TurnManager — 回合流转
│   ├── deck_validator.py  # 卡组合法性校验
│   └── enums.py           # GameState, Phase, ActionType
```

**关键设计:**
- `GameEngine` 维护完整游戏状态，纯函数式状态转换
- `Battlefield` 管理格子坐标系统（行×列），单位站位
- `CombatResolver` 处理攻击/防御/效果结算
- `TurnManager` 控制抽牌→出牌→战斗→结束的流程

**数据模型扩展:**
```python
# GameSession model
class GameSession(Base):
    id: uuid
    player1_id: uuid → User
    player2_id: uuid → User
    state_json: JSON        # 完整游戏状态序列化
    current_turn: int
    status: enum            # waiting/playing/finished
    winner_id: uuid | None
    started_at: datetime
    finished_at: datetime | None
```

### Phase 3: WebSocket 实时对战

**目标**: 低延迟实时通信

```
app/
├── websocket/
│   ├── manager.py         # ConnectionManager — 连接池管理
│   ├── handler.py         # WebSocket 消息分发
│   ├── protocol.py        # 消息协议定义 (JSON Schema)
│   └── game_room.py       # GameRoom — 房间状态管理
```

**消息协议:**
```json
// 客户端 → 服务端
{ "type": "play_card", "data": { "card_id": "uuid", "position": [2, 3] } }
{ "type": "attack", "data": { "attacker_pos": [2,3], "target_pos": [4,1] } }
{ "type": "end_turn" }

// 服务端 → 客户端
{ "type": "game_state", "data": { ... } }          // 完整状态同步
{ "type": "action_result", "data": { ... } }       // 操作结果
{ "type": "opponent_action", "data": { ... } }     // 对手操作通知
{ "type": "game_over", "data": { "winner": "p1" } }
```

**关键设计:**
- Redis Pub/Sub 支持多进程 WebSocket（如果 worker > 1）
- 断线重连：客户端携带 `session_id` 重连，服务端恢复状态
- 超时机制：每步操作 30 秒倒计时

### Phase 4: 卡牌效果系统

**目标**: 可扩展的效果引擎

```
app/
├── game/
│   ├── effects/
│   │   ├── dispatcher.py   # EffectDispatcher — 效果路由
│   │   ├── base.py         # BaseEffect 抽象类
│   │   ├── damage.py       # 伤害效果
│   │   ├── heal.py         # 治疗效果
│   │   ├── buff.py         # 增益/减益
│   │   ├── summon.py       # 召唤效果
│   │   └── special.py      # 特殊效果（势力独有）
```

**设计:**
```python
class BaseEffect(ABC):
    @abstractmethod
    async def execute(self, ctx: EffectContext) -> EffectResult: ...

class EffectDispatcher:
    def __init__(self):
        self._registry: dict[str, BaseEffect] = {}

    def register(self, code: str, effect: BaseEffect): ...
    async def dispatch(self, code: str, ctx: EffectContext) -> EffectResult: ...
```

- `effect_code` 存储在 Card 模型中，如 `"damage_aoe_3"`, `"buff_atk_2_t2"`
- 效果可组合：一张卡多个效果按顺序执行
- 每势力独有特殊效果

### Phase 5: 排行榜 + ELO 匹配

**目标**: 竞技排名和公平匹配

```
app/
├── ranking/
│   ├── elo.py             # ELO 评分算法
│   ├── leaderboard.py     # 排行榜查询（Redis Sorted Set）
│   └── matchmaking.py     # 匹配队列 + 匹配算法
```

**数据模型扩展:**
```python
class PlayerRating(Base):
    id: uuid
    user_id: uuid → User
    rating: int            # ELO 分数，初始 1000
    wins: int
    losses: int
    draws: int
    season: int            # 赛季
    last_match_at: datetime | None
```

**匹配流程:**
1. 玩家点击"匹配" → 加入 Redis 匹配队列
2. Matchmaker 每秒扫描队列，按 ELO 差值 < 200 配对
3. 等待超时（30s）后扩大搜索范围
4. 配对成功 → 创建 GameSession → WebSocket 通知双方

## 编码规范

### 必须遵守

```python
# ❌ 禁止 — Pydantic v2 无法在生成 OpenAPI schema 时解析 ForwardRef
from __future__ import annotations

# ✅ 正确 — 直接用类型
from uuid import UUID
from datetime import datetime

class CardResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime | None   # 可空用 | None，不用 Optional
```

### UUID 序列化

```python
from pydantic import BaseModel, field_serializer
from uuid import UUID

class CardResponse(BaseModel):
    id: UUID

    @field_serializer("id")
    def serialize_id(self, v: UUID) -> str:
        return str(v)
```

### 分页统一格式

```python
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
```

**所有列表接口必须返回此格式。**

### async session 管理

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

async def get_cards(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    # db 由依赖注入管理，自动 commit/rollback
    ...
```

### datetime 字段

```python
from datetime import datetime

class MyModel(BaseModel):
    created_at: datetime | None = None    # 必须用 | None，不用 Optional
    updated_at: datetime | None = None
```

### 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| Router 函数 | snake_case | `get_card_by_id` |
| Service 方法 | snake_case | `create_card` |
| Repository 方法 | snake_case | `find_by_id` |
| Schema 类 | PascalCase + 后缀 | `CardResponse`, `CardCreate` |
| Model 类 | PascalCase 单数 | `Card`, `User` |
| 常量 | UPPER_SNAKE | `MAX_DECK_SIZE = 30` |

### 错误处理

```python
from fastapi import HTTPException

# Service 层抛 HTTPException
async def get_card(self, card_id: UUID, db: AsyncSession):
    card = await self.repo.find_by_id(card_id, db)
    if not card:
        raise HTTPException(status_code=404, detail="卡牌不存在")
    return card
```

---

*Last updated: 2026-06-06*
