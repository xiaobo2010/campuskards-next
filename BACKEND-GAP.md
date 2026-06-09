# CampusKards - 前后端 API 差异分析

> 最后更新：2026-06-09  
> v1 对战引擎机制已补全；本文档跟踪**非对战**或**运维/扩展**类缺口。

## 已实现模块（前后端已对齐）

| 模块 | 状态 | 说明 |
|------|------|------|
| Auth | ✅ | register / login / refresh / me / logout / set-cookie / reset-password |
| Cards | ✅ | 分页列表 + 详情（需登录） |
| Collection | ✅ | GET / POST / DELETE / upgrade |
| Decks | ✅ | CRUD + validate |
| Shop | ✅ | packs / buy / open |
| Checkin | ✅ | status + daily checkin |
| User | ✅ | profile + avatar upload |
| Announcements | ✅ | 公开只读 GET；写操作在 `/api/admin/announcements` |
| Admin | ✅ | stats / users / cards / announcements CRUD + pin |
| Leaderboard | ✅ | 公开 ELO 排行 |

## 已实现（v1）— Match / WebSocket / 对战引擎

| 方法 | 路径 | 状态 |
|------|------|------|
| POST | `/api/match/queue` | ✅ |
| DELETE | `/api/match/queue` | ✅ |
| GET | `/api/match/queue/status` | ✅ |
| GET | `/api/match/history` | ✅ |
| GET | `/api/match/{id}` | ✅ |
| POST | `/api/match/{id}/surrender` | ✅ |
| WS | `/ws/game/{match_id}` | ✅ |

**前端 `matchmaking` / `play` 已接入** REST + WebSocket（v1 可玩）。

### v1 对战引擎（已实现）

- 五派系**全局协同** + **邻位同派系局部协同**
- **五派系被动**（重点班减伤、艺体班首张命令减费、普通班数量加攻、国际班手牌加墨、竞赛班少量精锐加攻）
- **抉择 / 条件分支 / 弃牌选择**（`resolve_choice` / `resolve_discard`）
- **反制陷阱区**（`play_trap` / 对手出牌触发 / 取消法术）
- **回合结束 / 对手出牌**时点效果
- 关键词：**飞行、穿透、先攻、冲锋、远程、免疫、沉默、操控、吞噬**
- **阵线移动**（`move_unit`，飞行免费）
- **近战仅上前线**；**军师 Advisor 槽**
- **卡牌等级**属性进对战；**ELO 墨水上限**加成
- 走廊控制、slot 部署、远程/支援线、HQ 生命加成、回合计时等

### WS 事件

`join_match` · `play_card` · `attack` · `end_turn` · `use_ability` · `resolve_choice` · `resolve_discard` · `move_unit`

### 仍待扩展（非阻塞 v1）

- 多 worker 对战广播（Redis Pub/Sub）
- 逐步回放 UI（后端已有 log/snapshot）
- PVE / 单人练习模式
- 非单位卡升级 +10%/级 的法术数值缩放（等级已进战场单位属性）
- 部分极复杂单卡效果仍依赖 `effect_text` 正则，未覆盖的会 no-op

详细规格见 `DEVELOPMENT.md` 第四章 4.10 / 4.11。

## Schema 约定（当前 canonical）

### UserOut (`GET /api/auth/me`)

```json
{ "id", "username", "email", "elo", "ink", "role", "avatar_url" }
```

### PaginatedResponse

```json
{ "items": [], "total": 0, "page": 1, "page_size": 20 }
```

## 前端适配注意

1. 认证统一使用 `AuthProvider`（`lib/auth-context.tsx`）
2. 对战：`pending_choice` 含 `discard` 时用 `resolve_discard`
3. 反制卡从手牌打出即进入 `traps` 区（无需单独按钮）
4. 双击己方单位 → 主动能力目标选择

## P2 增强（可选）

- Redis session / token 黑名单
- Rate limiting
- 完全 Cookie-only 认证
