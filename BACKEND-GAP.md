# CampusKards - 前后端 API 差异分析

> 最后更新：2026-06-08  
> 大部分 P0/P1 缺口已补齐；本文档仅跟踪**仍未实现**或**待对齐**项。

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

## 已实现（v1）— Match / WebSocket

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

### v1 限制

- 匹配队列：进程内 + Redis 镜像（`match:queue:quick` / `match:queue:ranked`）
- 对战状态：Redis 持久化（`match:room:{id}`）；WS 连接仍在单进程内存
- 多 worker / 水平扩展需 Redis Pub/Sub 广播（未实现）
- 效果牌：基于 `effect_text` 正则解析，覆盖抽牌/伤害/增益/召唤等常见模式；复杂抉择/条件效果为简化实现
- `use_ability`：支持含「主动/激活」词条的单位；无主动能力的卡仍返回错误
- 已实现：五派系协同（`key_class` / `arts_class` / `normal_class` / `intl_class` / `competition_class`）
- 已实现：走廊控制（前线满员且对手前线空 → 回合开始 +1 墨水）
- 已实现：`play_card` 的 `slot` 插入阵线指定位置
- 已实现：远程单位可越过前线攻击支援线；远程攻击不受反击
- 已实现：ELO≥2000 HQ 生命加成（`User.hq_bonus_hp`）于匹配开局应用
- 已实现：100s 回合计时、`timer_warning`（≤20s）、超时自动结束回合
- 已实现：支援线保护（近战单位）、单位/效果牌分流出牌
- 已实现：战斗结算防重复 finalize、即时匹配 `POST /queue` 返回 `match_id`

详细规格见 `DEVELOPMENT.md` 第四章 4.10 / 4.11。

## Schema 约定（当前 canonical）

### UserOut (`GET /api/auth/me`)

```json
{ "id", "username", "email", "elo", "ink", "role", "avatar_url" }
```

### Admin Stats (`GET /api/admin/stats`)

```json
{ "users", "cards", "announcements", "total_ink" }
```

### PaginatedResponse

```json
{ "items": [], "total": 0, "page": 1, "page_size": 20 }
```

### UserCardOut (`GET /api/collection`)

```json
{ "card_id", "count", "level", "fragments", "card": CardOut | null }
```

### 卡牌类型枚举（种子数据）

`unit` | `command` | `buff` | `counter`（小写）

## 前端适配注意

1. 认证统一使用 `AuthProvider`（`lib/auth-context.tsx`），墨水/头像通过 `useAuth()` 读写
2. 公告写操作走 `adminApi`，公开列表走 `announcementsApi`（只读）
3. 商店卡包列表从 `shopApi.listPacks()` 拉取，UI 样式用本地 `PACK_DISPLAY` 映射
4. 卡组创建需 30 张，主势力由卡牌多数 `faction_code` 推断
5. `NEXT_PUBLIC_API_URL` 生产环境必须指向 `https://gapi.xiaobocloud.fun`
6. 对战：queue → status 轮询 → `ws://<API>/ws/game/{match_id}?token=` → `join_match`

## P2 增强（可选）

- Redis session / token 黑名单
- Rate limiting（登录、重置密码、排行榜）
- 完全 Cookie-only 认证（去掉 localStorage token）
