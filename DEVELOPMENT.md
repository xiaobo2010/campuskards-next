# CampusKards 开发文档

> 本文档整合项目架构、技术决策、完整 API 规范、开发计划与 Bug 清单，供 coder 和 OpenCode 编程时快速参考。
> **coder 必须严格按照第四章的 API 定义开发，字段名、路径、请求/响应结构均不可自行更改。——如需变更，先更新本文档。**

---

## 一、项目概览

**CampusKards** 是一款校园主题卡牌对战游戏，灵感来自卡牌对战类游戏，以中国校园文化为背景。

| 项 | 值 |
|---|---|
| 前端 | Next.js 14 App Router + shadcn/ui + Framer Motion + Zustand + React Query |
| 后端 | FastAPI + SQLAlchemy 2.0 + PostgreSQL + Pydantic v2 |
| 前端部署 | Azure Tokyo `130.33.98.30:3001` |
| 后端部署 | XiaoBo Server `/ssd/7a40/campuskards/backend/` |
| 前端域名 | `campuskards.xiaobocloud.fun` |
| 后端域名 | `gapi.xiaobocloud.fun` |
| 本地仓库 | `~/.openclaw/workspace/code/campuskards/` |
| GitHub | `xiaobo2010/campuskards` |

### ⚠️ Known Constraints
- **XiaoBo Server 无法连 GitHub 和国外网站**，代码需从 OCI 推送后在 XiaoBo Server `git pull`
- 单次 coder task 改动 ≤ 3 个文件，降低回滚成本

---

## 二、核心游戏设计

### 2.1 卡牌类型映射

| 军事原型 | 校园卡牌 | 定位 |
|----------|---------|------|
| 步兵 | 课代表 | 低费均衡，攻守兼备 |
| 坦克 | 体育大佬 | 高耐久，Spirit 大幅增长 |
| 火炮 | 卷王 | 纯输出，Power 主增长 |
| 战斗机 | 纪律委员 | 速攻型，Power 略高 |
| 轰炸机 | 八卦社 | AOE 输出，Power 主增长 |

### 2.2 五大派系

| 派系 | 原型 | 风格 | 协同触发条件 | 协同效果 |
|------|------|------|-------------|---------|
| 精英班 (Elite) | 德 | 质量优先 | 场上≥2精英班 | 全体+1 Power |
| 艺术班 (Arts) | 英 | 持久战 | 场上≥3艺术班 | 全体+1 Spirit |
| 普通班 (Mass) | 苏 | 人海战术 | 场上≥4普通班 | 全体+1 Power +1 Spirit |
| 国际班 (Global) | 美 | 混合卡组 | ≥2国际班+≥1其他系 | 国际班+1 Power，其他+1 Spirit |
| 竞赛班 (Rush) | 日 | 快攻节奏 | ≥1竞赛班+本回合≥2次攻击 | 竞赛班+2 Power(回合结束) |

### 2.3 战场结构（4层）

```
P2 支援线 (P2 Support Line)
P2 前线   (P2 Front Line)
─────────────────────────
P1 前线   (P1 Front Line)
P1 支援线 (P1 Support Line)
```

- 从 2 层扩展至 4 层，支援线单位可跨线支援前线
- **局域加成**: 同阵线连续同势力己方单位获得势力专属效果加成

### 2.4 升级系统

- 卡牌等级 1-10，费用不变维持平衡
- **单位卡**: 每级 Power/Spirit/Grit 按类型增量 × 等级差
- **非单位卡**: 每级效果 +10%（整数向上取整）
- 货币: 碎片(同类卡通用) + 墨水(全局货币)
- 重复抽卡转化碎片: Common→1, Uncommon→2, Rare→4, Legendary→8
- 详细经验表见 `docs/upgrade-system-design.md`

### 2.5 ELO 与高级机制

- ELO≥2000 后每多 200 → +1初始笔芯上限 + 总部+1初始血量
- 详见 `docs/battlefield-depth-design.md` 和 `docs/faction-synergy-design.md`

---

## 三、关键架构决策

> 完整决策记录见 `memory/projects/campuskards/KEY-DECISIONS.md`

| 决策 | 选择 | 原因 |
|------|------|------|
| 认证架构 | Bearer token (localStorage) 为主，httpOnly cookie 为辅 | Edge middleware 无法读 localStorage，纯 cookie 导致登录后 302 循环 |
| Middleware 策略 | 只做 `root→/auth/login` 重定向，不做 /game 认证门控 | 客户端 `useAuth()` 替代服务端门控 |
| 渲染模式 | 所有页面 `export const dynamic = "force-dynamic"` + Nginx HTML no-cache | 防止 ISR 缓存导致旧 HTML 引用过期 chunk |
| Cookie SameSite | `SameSite=none; Secure` | 前后端跨子域，Strict 会被浏览器静默拒绝 |
| UUID 序列化 | `id: UUID` + `@field_serializer('id') → str` | 禁止 schema 文件用 `from __future__ import annotations` |
| API 基址 | `lib/config.ts` 统一管理，默认空(同源代理) | 消除 4 处硬编码 |
| Cookie 写入 | login 后必须显式调 `/api/auth/set-cookie` | login 响应的 Set-Cookie 被 FRP/Nginx 代理链吞掉 |

---

## 四、后端 API 完整规范

### 4.0 通用约定

| 项 | 规范 |
|---|---|
| Base Path | `/api` |
| 认证 | 大部分端点需 `Authorization: Bearer <access_token>` |
| 分页格式 | `{ items: T[], total: int, page: int, page_size: int }` |
| 错误格式 | `{ detail: string }` (FastAPI 默认) |
| UUID 序列化 | 所有 UUID 字段序列化为字符串，后端使用 `@field_serializer('id')` |
| Cookie | `campuskards_token` httpOnly cookie，`SameSite=none; Secure; Path=/` |

---

### 4.1 Auth 认证模块 `/api/auth`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | POST | `/api/auth/register` | ❌ | 用户注册 | ✅ |
| 2 | POST | `/api/auth/login` | ❌ | 用户登录 | ✅ |
| 3 | POST | `/api/auth/refresh` | ❌ | 刷新 Token | ✅ |
| 4 | GET | `/api/auth/me` | ✅ | 获取当前用户信息 | ✅ |
| 5 | POST | `/api/auth/set-cookie` | ✅ | 将 token 写入 httpOnly cookie | ✅ |
| 6 | POST | `/api/auth/logout` | ✅ | 登出(清除 cookie) | ✅ |

**1. POST /api/auth/register**
- 请求体：`{ username: str, password: str, email: str }`
- 响应 `201`：`{ access_token: str, refresh_token: str, token_type: "bearer" }`
- 副作用：自动设置 httpOnly cookie + 创建默认卡组
- 错误 `400`：用户名/邮箱已存在

**2. POST /api/auth/login**
- 请求体：`{ login: str, password: str, remember: bool = false }`
- 响应 `200`：`{ access_token: str, refresh_token: str, token_type: "bearer" }`
- ⚠️ 响应中的 Set-Cookie 可能被代理链吞掉，前端必须额外调用 `/api/auth/set-cookie`
- 错误 `401`：用户名或密码错误

**3. POST /api/auth/refresh**
- 请求体：`{ refresh_token: str }`
- 响应 `200`：`{ access_token: str, refresh_token: str, token_type: "bearer" }`

**4. GET /api/auth/me**
- 请求头：`Authorization: Bearer <token>`（或 cookie 自动携带）
- 响应 `200`：`{ id: str, username: str, email: str, elo: int, ink: int, role: str, avatar_url?: str }`

**5. POST /api/auth/set-cookie**
- 请求体：`{ access_token: str, refresh_token: str, remember: bool }`
- 响应 `200`：`{ message: "Cookie set" }`
- 校验：access/refresh token 必须合法且属于同一用户
- 副作用：设置 `campuskards_token` + `campuskards_refresh_token` httpOnly cookie
- Cookie 策略：`ENVIRONMENT=production` → `Secure; SameSite=none`；开发环境 → `SameSite=lax`

**6. POST /api/auth/logout** ✅
- 请求头：`Authorization: Bearer <token>` 或 cookie
- 响应 `200`：`{ message: "已登出" }`
- 副作用：清除 auth cookies

---

### 4.2 Cards 卡牌模块 `/api/cards`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/cards` | ✅ | 卡牌列表（分页+筛选） | ✅ |
| 2 | GET | `/api/cards/{id}` | ✅ | 卡牌详情 | ✅ |

**1. GET /api/cards**
- 查询参数：`faction: str?, card_type: str?, cost: int?, rarity: str?, page: int=1, page_size: int=20`
- 响应 `200`：`PaginatedResponse<CardOut>`
- `CardOut`：`{ id, name, name_en, faction_code, card_type, unit_type?, cost, power?, grit?, spirit?, effect_text?, effect_code?, rarity, flavor_text?, artist?, image_url?, is_token, set_code }`

**2. GET /api/cards/{id}**
- 路径参数：`id: UUID`
- 响应 `200`：`CardOut`

---

### 4.3 Collection 收藏模块 `/api/collection`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/collection` | ✅ | 我的卡牌收藏 | ✅ |
| 2 | POST | `/api/collection/{card_id}` | ✅ | 添加卡牌到收藏 | ✅ |
| 3 | DELETE | `/api/collection/{card_id}` | ✅ | 从收藏移除卡牌 | ✅ |
| 4 | POST | `/api/collection/{card_id}/upgrade` | ✅ | 升级卡牌 | ✅ |

**1. GET /api/collection**
- 响应 `200`：`[ { card_id, count, level, fragments, card: CardOut | null } ]`

**2. POST /api/collection/{card_id}**
- 请求体：`{ count: int=1 }`

**3. DELETE /api/collection/{card_id}**
- 请求体：`{ count: int=1 }`

**4. POST /api/collection/{card_id}/upgrade**
- 请求体：空
- 条件：碎片 + 墨水足够
- 错误 `400`：经验不足或货币不够

---

### 4.4 Decks 卡组模块 `/api/decks`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/decks` | ✅ | 我的卡组列表 | ✅ |
| 2 | POST | `/api/decks` | ✅ | 创建卡组 | ✅ |
| 3 | GET | `/api/decks/{id}` | ✅ | 卡组详情(含卡牌) | ✅ |
| 4 | PUT | `/api/decks/{id}` | ✅ | 更新卡组 | ✅ |
| 5 | DELETE | `/api/decks/{id}` | ✅ | 删除卡组 | ✅ |
| 6 | GET | `/api/decks/{id}/validate` | ✅ | 校验卡组合法性 | ✅ |

**2. POST /api/decks**
- 请求体：`{ name: str, faction_code: str, ally_faction_code?: str }`
- 响应 `201`：`{ id, name, faction_code, ally_faction_code?, is_default, created_at, entries: [ { card_id, quantity, card: CardOut } ] }`

**4. PUT /api/decks/{id}**
- 请求体：`{ name?, faction_code?, ally_faction_code? | null, entries?: [ { card_id, quantity } ] }`

**6. GET /api/decks/{id}/validate**
- 响应：`{ valid: bool, errors: [str] }`
- 校验规则：卡牌总数=30, 主势力卡≥20, 同名牌≤3, 卡牌在收藏中

---

### 4.5 Shop 商店模块 `/api/shop`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/shop/packs` | ✅ | 卡包列表 | ✅ |
| 2 | POST | `/api/shop/packs/{id}/buy` | ✅ | 购买卡包 | ✅ |
| 3 | POST | `/api/shop/packs/{id}/open` | ✅ | 开包 | ✅ |

**1. GET /api/shop/packs**
- 响应：`[ { id, name, description?, price_ink, cards_count, rarity_weights?, image_url?, faction_code? } ]`

**2. POST /api/shop/packs/{id}/buy**
- 请求体：`{ quantity: int=1 }`
- 响应：`{ pack_id, quantity, total_cost, remaining_ink }`

**3. POST /api/shop/packs/{id}/open**
- 请求体：`{ quantity: int=1, faction_code?: str }`
- 响应：`{ cards, new, fragments, remaining_ink, can_reroll?, reroll_token? }`
- **选卡卡包 (`selector`)**：开包时扣费但不立即入库；返回 `can_reroll=true` 与 `reroll_token`

**4. POST /api/shop/packs/selector/finalize** ✅
- 请求体：`{ reroll_token: str }`
- 放弃重抽，将全部卡牌写入收藏

**5. POST /api/shop/packs/selector/reroll** ✅
- 请求体：`{ reroll_token: str, slot_index: int }`
- 替换指定位置卡牌（单次），然后写入收藏

---

### 4.6 Checkin 签到模块 `/api/checkin`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/checkin/status` | ✅ | 签到状态 | ✅ |
| 2 | POST | `/api/checkin` | ✅ | 执行签到 | ✅ |

**1. GET /api/checkin/status**
- 响应：`{ checked_in_today: bool, streak: int, total_checkins: int, next_reward: { day: int, ink: int, fragments?: int } }`

**2. POST /api/checkin**
- 响应：`{ streak: int, reward: { ink: int, fragments?: int }, total_checkins: int }`

---

### 4.7 User 用户模块 `/api/user`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/user/profile` | ✅ | 获取个人资料 | ✅ |
| 2 | PUT | `/api/user/profile` | ✅ | 更新个人资料 | ✅ |

**1. GET /api/user/profile**
- 响应：`{ id, username, email, elo, ink, role, created_at, stats: { total_wins, total_losses, total_draws, win_rate } }`

---

### 4.8 Announcements 公告模块 `/api/announcements`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/announcements` | ✅ | 公告列表(分页) | ✅ |
| 2 | GET | `/api/announcements/{id}` | ✅ | 公告详情 | ✅ |

**1. GET /api/announcements**
- 查询参数：`category: str? (update|event|maintenance|general), page=1, page_size=20`
- 响应：`PaginatedResponse<{ id, title, content, category, priority, is_pinned, created_at, updated_at, author: { id, username } }>`

---

### 4.9 Admin 管理模块 `/api/admin`

| # | 方法 | 路径 | 认证 | 说明 | 状态 |
|---|------|------|------|------|------|
| 1 | GET | `/api/admin/stats` | ✅ Admin | 系统统计 `{ users, cards, announcements, total_ink }` | ✅ |
| 2 | GET | `/api/admin/users` | ✅ Admin | 用户列表 | ✅ |
| 3 | POST | `/api/admin/announcements` | ✅ Admin | 创建公告 | ✅ |
| 4 | PUT | `/api/admin/announcements/{id}` | ✅ Admin | 更新公告 | ✅ |
| 5 | DELETE | `/api/admin/announcements/{id}` | ✅ Admin | 删除公告 | ✅ |
| 6 | PATCH | `/api/admin/announcements/{id}/pin` | ✅ Admin | 置顶/取消置顶 | ✅ |

---

### 4.10 Match 对战模块 `/api/match` 🔴 全部未实现

> 游戏核心功能，最高优先级。coder 实现时必须严格遵循以下规格。

| # | 方法 | 路径 | 认证 | 说明 | 优先级 |
|---|------|------|------|------|--------|
| 1 | POST | `/api/match/queue` | ✅ | 加入匹配队列 | P0 |
| 2 | DELETE | `/api/match/queue` | ✅ | 取消匹配 | P0 |
| 3 | GET | `/api/match/queue/status` | ✅ | 查询匹配状态 | P0 |
| 4 | GET | `/api/match/history` | ✅ | 对战历史(分页) | P1 |
| 5 | GET | `/api/match/{id}` | ✅ | 对战详情 | P1 |
| 6 | POST | `/api/match/{id}/surrender` | ✅ | 投降 | P1 |

**1. POST /api/match/queue**
- 请求体：`{ deck_id: UUID }`
- 响应 `200`：`{ status: "queued", queue_position: int, estimated_wait: int(ms) }`
- 逻辑：加入 Redis 匹配池，按 ELO 范围匹配
- 错误 `400`：卡组不合法 / 已在队列中

**2. DELETE /api/match/queue**
- 响应 `200`：`{ status: "cancelled" }`

**3. GET /api/match/queue/status**
- 响应 `200`：`{ status: "queued"|"matched"|"idle", match_id?: UUID, opponent?: { id, username, elo } }`
- `matched` 时返回对战 ID 和对手信息

**4. GET /api/match/history**
- 查询参数：`page, page_size, result: "win"|"loss"|"draw"|None`
- 响应 `200`：`PaginatedResponse<{ id, opponent: { id, username, elo }, result, my_deck_faction, opponent_deck_faction, turns_played, started_at, ended_at }>`

**5. GET /api/match/{id}**
- 响应 `200`：`{ id, p1: UserInfo, p2: UserInfo, winner_id?, turns_played, started_at, ended_at, replay_data?: dict }`

**6. POST /api/match/{id}/surrender**
- 响应 `200`：`{ result: "loss", elo_change: int }`

---

### 4.11 Game WebSocket 对战通信 `/ws/game/{match_id}` 🔴 未实现

> 实时对战状态同步，基于 WebSocket。

**连接**：`wss://gapi.xiaobocloud.fun/ws/game/{match_id}?token=<access_token>`

| # | 方向 | 事件 | 载荷 | 说明 | 优先级 |
|---|------|------|------|------|--------|
| 1 | C→S | `join_match` | `{ match_id }` | 加入对战房间 | P0 |
| 2 | C→S | `play_card` | `{ card_id, position: "front"|"support", slot: int }` | 出牌布阵 | P0 |
| 3 | C→S | `attack` | `{ attacker_ids: [UUID], target_id?: UUID }` | 攻击指令 | P0 |
| 4 | C→S | `end_turn` | `{}` | 结束回合 | P0 |
| 5 | C→S | `use_ability` | `{ card_id, ability_id, target_id? }` | 使用能力 | P1 |
| 6 | S→C | `game_state` | 见下方结构 | 全量状态推送 | P0 |
| 7 | S→C | `turn_start` | `{ player: "p1"|"p2", timer: int }` | 回合开始 | P0 |
| 8 | S→C | `card_played` | `{ player, card_id, position, slot }` | 卡牌被打出 | P0 |
| 9 | S→C | `attack_result` | `{ attacker_id, target_id?, damage, destroyed: [UUID] }` | 攻击结算 | P0 |
| 10 | S→C | `game_over` | `{ winner_id, elo_change: { p1: int, p2: int } }` | 对战结束 | P0 |
| 11 | S→C | `timer_warning` | `{ seconds_left: int }` | 倒计时警告 | P1 |

**game_state 结构**：
```json
{
  "turn": 1,
  "phase": "draw|main|combat|end",
  "current_player": "p1",
  "timer": 30,
  "players": {
    "p1": {
      "hp": 20, "max_hp": 20, "ink": 3, "max_ink": 3,
      "hand": ["uuid1", "uuid2"],
      "front_line": [{ "card_id": "uuid", "power": 3, "spirit": 2, "grit": 1, "can_attack": true }],
      "support_line": [],
      "deck_count": 20, "pen_count": 0
    },
    "p2": { "hand_count": 5, ... }
  }
}
```

**回合流程**：draw(抽牌) → main(出牌+布阵) → combat(攻击结算) → end(回合切换)

---

### 4.12 API 实现状态总览

| 模块 | 已实现 | 未实现 | 完成度 |
|------|--------|--------|--------|
| Auth | 6/6 | — | 100% |
| Cards | 2/2 | — | 100% |
| Collection | 4/4 | — | 100% |
| Decks | 6/6 | — | 100% |
| Shop | 3/3 | — | 100% |
| Checkin | 2/2 | — | 100% |
| User | 2/2 | — | 100% |
| Announcements | 2/2 | — | 100% |
| Admin | 6/6 | — | 100% |
| **Match** | **0/6** | **全部** | **0%** |
| **Game WS** | **0/11** | **全部** | **0%** |
| **总计** | **33/50** | **17** | **66%** |

---

## 五、前端开发计划（5 阶段）

### Phase 0 — 紧急修复 ✅ 已完成
- [x] P0-1 middleware 不保护 /game 路由
- [x] P0-fix login cookie 被代理链吞掉 → 显式调 /api/auth/set-cookie
- [x] P0-2 Token 持久化 httpOnly cookie
- [x] P0-3 API_BASE 四处硬编码收敛至 lib/config.ts
- [x] P0-9 卡组建造器重设计
- [x] P0-10 卡组建造器数据源修复

### Phase 1 — 基础设施加固 ⬜ 待完成
- [x] 1.1 API 客户端重构 (`lib/api.ts` — 拦截器、错误类型、重试)
- [x] 1.2 AuthContext 重构 (`lib/auth-context.tsx` — cookie 优先、自动续签)
- [ ] **1.3** React Query 集成 (`lib/query-client.ts` + `components/providers.tsx`)
- [ ] **1.4** React Query Devtools 安装
- [ ] **1.5** 数据 hooks 抽取 (`hooks/use-cards.ts`, `use-decks.ts`, `use-user.ts`, `use-match.ts`)
- [ ] **1.6** 页面组件迁移到 React Query hooks

### Phase 2 — Zustand 拆分 & 状态治理 ⬜ 待完成
- [ ] **2.1** 拆分 `useGameStore` → `useAuthStore` + `useCollectionStore` + `useDeckStore` + `useMatchStore`
- [ ] **2.2** 迁移各页面到对应 store
- [ ] **2.3** 删除旧 `store.ts`

### Phase 3 — 页面完善 & 交互升级 ⬜ 待完成
- [ ] **3.1** 安装 Framer Motion
- [ ] **3.2** 补全 shadcn/ui: `dialog`, `toast`, `select`, `tabs`, `dropdown-menu`
- [ ] **3.3** 各路由添加 `loading.tsx` / `error.tsx`
- [ ] **3.4** 全局 Error Boundary
- [ ] **3.5** Landing 页: 动画 + 角色展示 + CTA
- [ ] **3.6** 登录/注册: 表单验证 + 错误提示
- [ ] **3.7** 卡牌图鉴: 筛选栏 + 卡牌网格 + 详情弹窗 + 稀有度动画
- [ ] **3.8** 套牌构筑: 拖拽编辑 + 卡牌搜索 + 存档提示
- [ ] **3.9** 对战页: 匹配 + 战场 UI (先做单人 PVE 壳)

### Phase 4 — 视觉打磨 & 性能 ⬜ 待完成
- [ ] **4.1** 落实设计系统 tokens
- [ ] **4.2** L1 呼吸动画: hover/focus/card micro
- [ ] **4.3** L2 对话动画: 页面切换/列表 stagger
- [ ] **4.4** L3 沉浸动画: 传说卡光环/对战特效
- [ ] **4.5** 移动端适配
- [ ] **4.6** Lighthouse > 90

---

## 六、Bug 清单与修复状态

### P0 紧急 — ✅ 全部完成

### P1 应快修

| # | Bug | 改动范围 | 状态 |
|---|-----|---------|------|
| P1-4 | Zustand store 拆分 | `store/useAuthStore` + `useCollectionStore` + `useDeckStore` | ✅ |
| P1-5 | AuthGuard 客户端门控 | `middleware.ts` 不做 /game 拦截 + `auth-guard.tsx` 重定向 | ✅ 2026-06-08 |
| P1-6 | API 统一错误处理 | `lib/api.ts` formatApiDetail + `api-error.ts` | ✅ 2026-06-08 |
| P1-17 | Admin stats 字段对齐 | `admin/page.tsx` ↔ `api/admin.py` | ✅ 2026-06-08 |
| P1-18 | 卡组类型大小写 | `deck-builder/page.tsx` getCategory | ✅ 2026-06-08 |
| P1-19 | 双轨认证不同步 | 统一 `useAuth()` 管理墨水/头像 | ✅ 2026-06-08 |
| P1-20 | JWT UTC NameError | `backend/app/core/security.py` | ✅ 2026-06-08 |
| P1-7 | User.role 加数据库索引 | backend alembic migration | ⬜ |
| P1-8 | Redis 配置决策(删或实现) | `backend/app/core/config.py` | ⬜ |
| P1-11 | 大厅背景图跟随侧边栏 | `game/layout.tsx` | ✅ |
| P1-12 | 图片缓存/加载优化 | `next.config.mjs` | ✅ |
| P1-14 | 卡牌图鉴"总计0张" | backend seed + frontend | ✅ |
| P1-15 | 卡牌升级系统 | collection upgrade API | ✅ |
| P1-16 | 卡牌详情 | `card-detail-modal.tsx` | ✅ |

### P2 体验优化 — ⬜ 待修复

| # | Bug | 改动范围 | 状态 |
|---|-----|---------|------|
| P2-13 | 签到按钮防抖 | `checkin-banner.tsx` | ✅ 已有isLoading |
| P2-9 | 核心页面补齐 L1 动效 | 多个页面组件 | ⬜ |
| P2-10 | 补充复合 UI 组件 | `components/ui/` | ⬜ |
| P2-11 | .env.example + 文档 | 项目根目录 | ⬜ |

### 工作规则
1. 每个 coder task ≤ 3 文件改动，prompt 写明具体文件/API/组件名
2. coder 完成后派 review 审核
3. Blocking → 重修，Warning → 记录继续，Approved → 下一个
4. **Phase 0 ✅ → Phase 1 → Phase 2**，按序推进

---

## 七、目标目录结构

```
frontend/src/
├── app/
│   ├── layout.tsx              ← 根布局 (QueryClient + Auth)
│   ├── globals.css             ← Tailwind + CSS vars
│   ├── page.tsx                ← Landing
│   ├── loading.tsx / error.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── game/
│       ├── layout.tsx          ← 游戏导航布局
│       ├── page.tsx            ← 大厅
│       ├── collection/         ← 卡牌图鉴
│       ├── deck-builder/       ← 套牌构筑
│       └── play/               ← 对战
├── components/
│   ├── ui/                     ← shadcn/ui 组件
│   ├── game/                   ← 游戏专用组件
│   │   ├── card-grid.tsx
│   │   ├── card-detail.tsx
│   │   ├── deck-editor.tsx
│   │   └── battlefield.tsx
│   └── providers.tsx           ← 合并 Provider
├── lib/
│   ├── api.ts                  ← 基础 API 客户端
│   ├── config.ts               ← API_BASE 等配置
│   ├── auth-context.tsx        ← 认证 Context
│   ├── query-client.ts         ← React Query 配置
│   ├── hooks/                  ← 数据 hooks
│   └── utils.ts                ← 工具函数
├── stores/                     ← Zustand stores (按领域)
├── middleware.ts               ← 仅 root→login 重定向
└── types/                      ← TypeScript 类型定义
```

---

## 八、部署 & 运维

### 前端 (Azure Tokyo)
```bash
cd /home/xiaobo2010/campuskards-deploy
git pull
npm run build
pm2 restart campuskards  # 或 systemd --user restart campuskards
```

### 后端 (XiaoBo Server)
```bash
cd /ssd/7a40/campuskards/backend
git pull
# Supervisor 或 systemd service 管理
```

### 流程：代码从本地推送到生产
```
OCI (push GitHub) → XiaoBo Server (git pull) → 重启服务
```

---

## 九、设计规范参考

- **审美体系**: `memory/design-systems.md` + `memory/dynamics.md`
  - L1 呼吸: hover 微交互、focus ring、卡片微动 (每页 ≥ 2 个)
  - L2 对话: 页面切换 transition、列表 stagger (Landing 必有)
  - L3 沉浸: 传说卡光环、对战特效
- **色彩**: 暗色系，对标 Linear/Claude 品质
- **响应式**: 移动端优先，底部导航优化

---

## 十、扩展设计文档

| 文档 | 路径 | 内容 |
|------|------|------|
| 战场深度扩展 | `docs/battlefield-depth-design.md` | 4层战场、支援线机制、跨线支援 |
| 派系协同系统 | `docs/faction-synergy-design.md` | 五派系协同触发条件与效果、前后端实现 |
| 卡牌升级系统 | `docs/upgrade-system-design.md` | 经验表、属性成长公式、碎片获取、API 设计 |
| 后端缺口分析 | `BACKEND-GAP.md` | 未实现 API 清单与优先级 |
| 游戏扩充方案 | `GAME-ADDON.md` | 新模式/新机制提案 |

---

*最后更新: 2026-06-08*
