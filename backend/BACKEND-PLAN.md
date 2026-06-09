# CampusKards 后端开发计划

## 已完成功能 (2026-06-09)

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ✅ | 注册/登录/登出/JWT/httpOnly cookie/密码重置/资料修改 |
| 卡牌 CRUD | ✅ | 管理员增删改；分页+筛选查询；公开列表+详情 |
| 卡牌收藏 | ✅ | 查看/添加/删除/升级/碎片转化 |
| 卡组系统 | ✅ | CRUD + 完整卡组校验(30张/20势力/22生物/20效果/10反击/3上限) |
| 商店系统 | ✅ | 5种卡包(基础/进阶/选卡/势力/声望)；购买+开包+选卡重抽 |
| 签到系统 | ✅ | 每日签到连续奖励(200~500墨水) |
| 公告系统 | ✅ | 管理员 CRUD + 置顶；公开只读查询 |
| 用户管理 | ✅ | 管理员列表/搜索/角色/启用禁用/重置密钥 |
| 管理系统 | ✅ | 数据概览/用户管理/卡牌编辑/公告管理/卡牌重新导入 |
| 排行榜 | ✅ | ELO 排序(缓存100名) |
| 对战系统 | ✅ | 快速/排位/PVE 匹配；排队→开始→结算完整流程 |
| 对战引擎 | ✅ | 4层战场/5派系协同+被动/关键词/反制/抉择/走廊/等级属性 |
| WebSocket | ✅ | 16种事件双向通信；回合计时/超时/重连 |
| AI 系统 | ✅ | PVE 机器人；AI 自动补位；ELO 自适应难度 |
| 卡牌数据 | ✅ | 300张卡牌+8势力+seed脚本幂等导入 |
| 新手引导 | ✅ | 注册自动发放30张可对战卡组 |
| 部署脚本 | ✅ | deploy.sh (6模式) + deploy-backend/frontend + rollback |
| 战斗技巧 | ✅ | 8类55条；根据卡牌类型随机展示 |

## 后端架构（当前实际）

```
backend/
├── app/
│   ├── main.py                # FastAPI 实例 + 路由注册 + 启动关闭
│   ├── api/                   # REST API 路由层（含业务逻辑）
│   │   ├── auth.py            # 认证 + _grant_newbie_deck
│   │   ├── cards.py           # 卡牌列表/详情 + 升级系统常量
│   │   ├── collection.py      # 收藏 CRUD + 升级 + 碎片转化
│   │   ├── decks.py           # 卡组 CRUD + 校验
│   │   ├── shop.py            # 商店/卡包/选卡
│   │   ├── checkin.py         # 每日签到
│   │   ├── user.py            # 个人资料 + 头像上传
│   │   ├── announcements.py   # 公告只读
│   │   ├── admin.py           # 管理员所有操作
│   │   ├── leaderboard.py     # ELO 排行榜
│   │   └── match.py           # 对战匹配/历史/详情
│   ├── core/                  # 游戏引擎 + 基础设施
│   │   ├── config.py          # Pydantic Settings
│   │   ├── security.py        # JWT + 密码哈希
│   │   ├── database.py        # async engine + session
│   │   ├── cache.py           # Redis 连接
│   │   ├── game_engine.py     # 回合状态机
│   │   ├── battlefield.py     # 棋盘格子管理
│   │   ├── combat.py          # 战斗结算
│   │   ├── effect_engine.py   # 效果引擎
│   │   ├── triggers.py        # 时点触发
│   │   └── ...                # unit_status, faction_passives, etc.
│   ├── models/                # SQLAlchemy ORM（全部在 __init__.py）
│   ├── schemas/               # Pydantic v2 请求/响应
│   ├── services/              # 服务层
│   │   ├── game_manager.py    # 对局房间管理
│   │   ├── matchmaking.py     # 匹配队列
│   │   ├── game_state_store.py
│   │   ├── match_events_bus.py
│   │   ├── leaderboard_cache.py
│   │   ├── elo.py             # ELO 算法
│   │   ├── battle_rewards.py  # 战斗奖励
│   │   ├── pve_ai.py          # PVE AI 决策
│   │   └── pve_bot.py         # PVE 机器人账号
│   └── ws/
│       └── game.py            # WebSocket handler
├── scripts/
│   ├── seed_cards.py          # 卡牌导入（CLI + 可导入库）
│   ├── expand_cards.py        # 自动生成卡牌
│   └── card-data.json         # 300 张卡牌数据
├── alembic/                   # 数据库迁移（6个版本）
├── tests/                     # pytest 测试（9个文件）
└── pyproject.toml
```

## 编码规范

### 禁止

```python
# ❌ from __future__ import annotations  → Pydantic v2 OpenAPI 解析问题
# ❌ Optional[X]  → 一律用 X | None
# ❌ 在 schema 中省略 @field_serializer('id')  → UUID 字段必须转 str
```

### 必须遵守

- 分页统一 `{ items, total, page, page_size }`
- UUID 序列化用 `@field_serializer('id')`
- schema 不允许有 `from __future__ import annotations`
- datetime 可空用 `| None`

---

*Last updated: 2026-06-09*
