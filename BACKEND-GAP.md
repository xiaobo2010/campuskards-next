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

## 待实现（P0）

### Game / Match 对战系统

前端 `matchmaking` 与 `play` 页面当前为 Mock，需后续补齐：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/match/queue` | 加入匹配队列 |
| DELETE | `/api/match/queue` | 取消匹配 |
| GET | `/api/match/queue/status` | 匹配状态 |
| GET | `/api/match/history` | 对战历史 |
| GET | `/api/match/{id}` | 对战详情 |
| POST | `/api/match/{id}/surrender` | 投降 |
| WS | `/ws/game/{match_id}` | 实时对战状态同步 |

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

## P2 增强（可选）

- Redis session / token 黑名单
- Rate limiting（登录、重置密码、排行榜）
- 完全 Cookie-only 认证（去掉 localStorage token）
