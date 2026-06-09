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
| 前端部署 | 前端服务器（systemd + Next.js standalone） |
| 后端部署 | 后端服务器（systemd + FastAPI） |
| 前端域名 | 按生产环境配置（如 `https://your-frontend-domain.com`） |
| 后端域名 | 按生产环境配置（如 `https://api.your-domain.com`） |
| 后端端口 | `127.0.0.1:8000`（通过 Nginx 反向代理至 API 域名） |
| 前端端口 | `3000`（Next.js standalone 模式） |

### ⚠️ Known Constraints
- 若后端服务器网络受限，需通过中转同步代码后再 `git pull`
- 测试统一在 `backend/` 目录下通过 `pytest` 运行（`backend/tests/` 含 12 个测试文件）

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
| 音频引擎 | howler.js（非原生 `<audio>`） | 自动处理 autoplay 政策、fade 过渡、多格式回退、sprite 播放 |
| 音频状态 | Zustand + `persist` middleware | 音量/开关偏好跨页面刷新持久化 |
| SFX 缓存 | 共享 Howl 实例（`Map<string, Howl>`） | 避免相同音效重复加载文件 |
| 首点解锁 | 全屏 overlay + `localStorage` 标记 | 满足浏览器 autoplay 限制，最少 UX 打扰 |

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

| # | 方法 | 路径 | 认证 | 说明 | 安全 | 状态 |
|---|------|------|------|------|------|------|
| 1 | POST | `/api/auth/register` | ❌ | 用户注册 | ⏱ 3次/IP/h | ✅ |
| 2 | POST | `/api/auth/login` | ❌ | 用户登录 | ⏱ 5次/IP/min | ✅ |
| 3 | POST | `/api/auth/refresh` | ❌ | 刷新 Token | `ver` 校验 | ✅ |
| 4 | GET | `/api/auth/me` | ✅ | 获取当前用户信息 | `ver` 校验 | ✅ |
| 5 | POST | `/api/auth/set-cookie` | ✅ | 将 token 写入 httpOnly cookie | 持有者证明 | ✅ |
| 6 | POST | `/api/auth/logout` | ✅ | 登出(清除 cookie + 自增 token_version) | 令牌立即失效 | ✅ |
| 7 | POST | `/api/auth/reset-password` | ❌ | 重置密码(使用 reset_key) | ⏱ 3次/IP/10min | ✅ |
| 8 | PATCH | `/api/auth/me` | ✅ | 更新个人资料(密码/邮箱) | 改密码自增 ver | ✅ |

**1. POST /api/auth/register**
- 请求体：`{ username: str(3-32, 字母数字下划线中文), password: str(8-128, 必须含字母+数字), email: EmailStr, remember: bool = true }`
- 响应 `201`：`{ access_token: str, refresh_token: str, token_type: "bearer" }`
- 副作用：自动设置 httpOnly cookie + 自动发放 30 张新手卡牌
- 错误 `409`：用户名/邮箱已存在
- ⏱ 频率限制：3 次/IP/小时

**2. POST /api/auth/login**
- 请求体：`{ login: str, password: str, remember: bool = false }`
- 响应 `200`：`{ access_token: str, refresh_token: str, token_type: "bearer" }`
- ⚠️ 响应中的 Set-Cookie 可能被代理链吞掉，前端必须额外调用 `/api/auth/set-cookie`
- 错误 `401`：用户名或密码错误
- ⏱ 频率限制：5 次/IP/分钟
- 🔐 `ver` 校验：使用 `user.token_version` 签发，不匹配则拒绝

**3. POST /api/auth/refresh**
- 请求体：`{ refresh_token: str }`
- 响应 `200`：`{ access_token: str, refresh_token: str, token_type: "bearer" }`
- 🔐 校验 payload 中 `ver` 与 `user.token_version` 一致

**4. GET /api/auth/me**
- 请求头：`Authorization: Bearer <token>`（或 cookie 自动携带）
- 响应 `200`：`{ id: str, username: str, email: str, elo: int, ink: int, role: str, avatar_url?: str }`

**5. POST /api/auth/set-cookie**
- 请求体：`{ access_token: str, refresh_token: str, remember: bool }`
- 请求头：`Authorization: Bearer <当前用户 token>`（持有者证明）
- 响应 `200`：`{ message: "Cookie set" }`
- 校验：access/refresh token 必须合法且属于同一用户，且必须与当前认证用户一致
- 副作用：设置 `campuskards_token` + `campuskards_refresh_token` httpOnly cookie
- Cookie 策略：`ENVIRONMENT=production` → `Secure; SameSite=none`；开发环境 → `SameSite=lax`
- 🛡️ 持有者证明：仅当前用户可设置自己的 Cookie

**6. POST /api/auth/logout** ✅
- 请求头：`Authorization: Bearer <token>` 或 cookie
- 响应 `200`：`{ message: "已登出" }`
- 副作用：`user.token_version += 1`（所有已签发令牌立即失效）+ 清除 auth cookies
- 🛡️ 令牌自增版本号使所有旧 token 无法再通过 `_get_current_user` 校验

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
| 4 | POST | `/api/collection/{card_id}/upgrade` | ✅ | 升级卡牌等级 | ✅ |
| 5 | POST | `/api/collection/{card_id}/convert` | ✅ | 多余额外卡牌转化为碎片 | ✅ |

**1. GET /api/collection**
- 响应 `200`：`[ { card_id, count, level, fragments, card: CardOut | null } ]`

**2. POST /api/collection/{card_id}**
- 请求体：`{ count: int=1 }`

**3. DELETE /api/collection/{card_id}**
- 请求体：`{ count: int=1 }`

**4. POST /api/collection/{card_id}/upgrade**
- 请求体：空
- 条件：碎片 + 墨水足够
- 错误 `400`：碎片或墨水不足

**5. POST /api/collection/{card_id}/convert**
- 请求体：`{ count: int=1 }`
- 碎片价值：Common→1, Uncommon→2, Rare→4, Epic→8, Legendary→8
- 条件：`count < current_count`（至少保留 1 张）

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
| 2 | POST | `/api/shop/packs/{id}/buy` | ✅ | 购买卡包(仅扣费) | ✅ |
| 3 | POST | `/api/shop/packs/{id}/open` | ✅ | 开包(扣费+出卡) | ✅ |
| 4 | POST | `/api/shop/packs/selector/finalize` | ✅ | 确定选卡(放弃重抽) | ✅ |
| 5 | POST | `/api/shop/packs/selector/reroll` | ✅ | 选卡包重抽指定位置 | ✅ |
| 6 | POST | `/api/shop/open-pack` | ✅ | 旧版开包(兼容) | ✅ |

**1. GET /api/shop/packs**
- 响应：`[ { id, name, description, price_ink, cards_count, cost_type, price_elo, min_elo } ]`
- 可用卡包：`basic`(200墨/5张)、`advanced`(600墨/6张)、`selector`(1000墨/8张+选卡)、`faction`(800墨/5张指定势力)、`prestige`(500ELO/3张高稀有度)

**2. POST /api/shop/packs/{id}/buy**
- 请求体：`{ quantity: int=1 }`
- 响应：`{ pack_id, quantity, total_cost, remaining_ink, remaining_elo? }`
- 仅扣费，不出卡

**3. POST /api/shop/packs/{id}/open**
- 请求体：`{ quantity: int=1, faction_code?: str }`
- 响应：`{ cards, new, fragments, remaining_ink, can_reroll?, reroll_token? }`
- **选卡卡包 (`selector`)**：开包时扣费但不立即入库；返回 `can_reroll=true` 与 `reroll_token`

**4. POST /api/shop/packs/selector/finalize**
- 请求体：`{ reroll_token: str }`
- 放弃重抽，将全部卡牌写入收藏

**5. POST /api/shop/packs/selector/reroll**
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
| 1 | GET | `/api/user/profile` | ✅ | 获取个人资料+对战统计 | ✅ |
| 2 | PUT | `/api/user/avatar` | ✅ | 上传头像 | ✅ |

**1. GET /api/user/profile**
- 响应：`{ id, username, email, elo, ink, role, avatar_url?, created_at, stats: { total_wins, total_losses, total_draws, win_rate } }`

**2. PUT /api/user/avatar**
- Content-Type: `multipart/form-data`
- 字段：`avatar: File` (JPG/PNG/WebP, ≤2MB)
- 响应：`{ avatar_url: str }`

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
| 2 | GET | `/api/admin/users` | ✅ Admin | 用户列表(分页+搜索) | ✅ |
| 3 | PATCH | `/api/admin/users/{id}` | ✅ Admin | 更新用户(ink/elo/role/is_active) | ✅ |
| 4 | POST | `/api/admin/users/{id}/reset-key` | ✅ Admin | 设置密码重置密钥 | ✅ |
| 5 | GET | `/api/admin/cards` | ✅ Admin | 卡牌列表(分页+筛选) | ✅ |
| 6 | PATCH | `/api/admin/cards/{id}` | ✅ Admin | 编辑卡牌属性 | ✅ |
| 7 | POST | `/api/admin/cards/reseed` | ✅ Admin | 从 card-data.json 重新导入卡牌 | ✅ |
| 8 | GET | `/api/admin/announcements` | ✅ Admin | 公告列表 | ✅ |
| 9 | POST | `/api/admin/announcements` | ✅ Admin | 创建公告 | ✅ |
| 10 | PUT | `/api/admin/announcements/{id}` | ✅ Admin | 更新公告(全量) | ✅ |
| 11 | PATCH | `/api/admin/announcements/{id}` | ✅ Admin | 更新公告(部分) | ✅ |
| 12 | DELETE | `/api/admin/announcements/{id}` | ✅ Admin | 删除公告 | ✅ |
| 13 | PATCH | `/api/admin/announcements/{id}/pin` | ✅ Admin | 置顶/取消置顶 | ✅ |

---

### 4.10 Match 对战模块 `/api/match` ✅ v1 已实现

> 游戏核心功能。coder 实现时必须严格遵循以下规格。  
> **v1 说明**：快速 (`quick`) 与排位 (`ranked`) 使用**独立匹配队列**；排位胜负影响 ELO，快速不影响。  
> **AI 自动补位**：快速队列等待 >15 秒无人时，自动匹配 AI 对手（难度根据玩家 ELO 调整）。  
> 对战进行中状态写入 Redis（`match:room:{id}`）；结算时生成完整战报写入 PostgreSQL `matches.replay_data`。  
> WebSocket 连接仍在进程内存；多 worker 需配合 Redis Pub/Sub（待实现）。

| # | 方法 | 路径 | 认证 | 说明 | 优先级 |
|---|------|------|------|------|--------|
| 1 | POST | `/api/match/queue` | ✅ | 加入匹配队列 | ✅ |
| 2 | DELETE | `/api/match/queue` | ✅ | 取消匹配 | ✅ |
| 3 | GET | `/api/match/queue/status` | ✅ | 查询匹配状态 | ✅ |
| 4 | POST | `/api/match/pve` | ✅ | 单人练习（对战 AI） | ✅ |
| 5 | GET | `/api/match/stats` | ✅ | 对战统计数据 | ✅ |
| 6 | GET | `/api/match/history` | ✅ | 对战历史(分页) | ✅ |
| 7 | GET | `/api/match/{id}` | ✅ | 对战详情 | ✅ |
| 8 | POST | `/api/match/{id}/surrender` | ✅ | 投降 | ✅ |

**1. POST /api/match/queue**
- 请求体：`{ deck_id: UUID, mode: "quick"|"ranked" }`（默认 `quick`）
- 响应 `200`：`{ status: "queued", mode, queue_position: int, estimated_wait: int(ms) }` 或 `{ status: "matched", match_id }`
- 逻辑：加入对应模式的匹配池，同模式内按 ELO ±200 匹配；快速模式支持 AI 补位
- 错误 `400`：卡组不合法 / 已在队列中

**2. DELETE /api/match/queue**
- 响应 `200`：`{ status: "cancelled" }`

**3. GET /api/match/queue/status**
- 响应 `200`：`{ status: "queued"|"matched"|"idle", match_id?: UUID, opponent?: { id, username, elo } }`
- `matched` 时返回对战 ID 和对手信息（AI 对手显示为"训练AI"）

**4. POST /api/match/pve**
- 请求体：`{ deck_id: UUID }`
- 响应 `200`：`{ status: "matched", mode: "pve", match_id: UUID, opponent: { id, username, elo } }`
- 前置条件：用户不在匹配队列中，没有进行中的对局
- AI 难度根据用户 ELO 自动调整：<800 简单 / 800-1200 中等 / 1200-1600 困难 / 1600+ 大师

**5. GET /api/match/stats**
- 响应 `200`：`{ total_matches, wins, losses, draws, win_rate, ranked_matches, quick_matches, current_elo, elo_delta_7d, elo_timeline_7d }`

**6. GET /api/match/history**
- 查询参数：`page, page_size, result: "win"|"loss"|"draw"|None`
- 响应 `200`：`PaginatedResponse<{ id, opponent: { id, username, elo }, result, my_deck_faction, opponent_deck_faction, turns_played, started_at, ended_at }>`

**7. GET /api/match/{id}**
- 响应 `200`：`{ id, mode, end_reason?, p1, p2, winner_id?, turns_played, started_at, ended_at, replay_data?: dict }`
- `replay_data` 含 `event_log`、`summary`、`players`、`final_snapshot` 等完整战报

**8. POST /api/match/{id}/surrender**
- 响应 `200`：`{ result: "loss", elo_change: int }`

---

### 4.11 Game WebSocket 对战通信 `/ws/game/{match_id}` ✅ v1 已实现

> 实时对战状态同步，基于 WebSocket。消息统一封装为 `{ "event": string, "payload": object }`。

**连接**：`wss://<api-domain>/ws/game/{match_id}`  
**本地**：`ws://localhost:8000/ws/game/{match_id}`

**认证**（优先级从高到低）：
1. `Sec-WebSocket-Protocol` 子协议头 — 前端通过 `new WebSocket(url, [token])` 传递
2. `campuskards_token` httpOnly Cookie
3. `?token=` Query 参数（向下兼容，已不推荐）

仅对战双方可连接。Token 为 access_token（与 REST Bearer 相同）。

**引擎规则（v1）**：
- 回合阶段：`draw → main → combat → end`，与 `app/core/game_engine.py` 一致
- 前线最多 5 单位，支援线最多 4 单位（见 `battlefield.py`）
- 总部血量 `spirit_total` 默认 30，归零判负
- 墨水每回合 +1（上限 10），开局各 1 墨水
- 召唤疲劳：当回合部署的单位不可攻击
- 战斗：`effective_damage = max(0, power - grit)`；击杀后溢出伤害打到总部
- 卡组：匹配前校验 30 张、主派系 ≥20 张、单卡 ≤3 张

| # | 方向 | 事件 | 载荷 | 说明 | 优先级 |
|---|------|------|------|------|--------|
| 1 | C→S | `join_match` | `{ match_id }` | 加入对战房间 | ✅ |
| 2 | C→S | `play_card` | `{ card_id, position: "front"\|"support", slot?: int }` | 出牌布阵 | ✅ |
| 3 | C→S | `attack` | `{ attacker_ids: [str], target_id?: str }` | 攻击指令 | ✅ |
| 4 | C→S | `end_turn` | `{}` | 结束回合 | ✅ |
| 5 | C→S | `use_ability` | `{ card_id, ability_id, target_id? }` | 使用能力（引擎已支持，前端待接入） | 🔶 |
| 6 | S→C | `game_state` | 见下方结构 | 全量状态推送 | ✅ |
| 7 | S→C | `turn_start` | `{ player: "p1"\|"p2", timer: int }` | 回合开始 | ✅ |
| 8 | S→C | `card_played` | `{ player, card_id, instance_id, position, slot }` | 卡牌被打出 | ✅ |
| 9 | S→C | `attack_result` | `{ attacker_id, target_id?, damage, destroyed: [str] }` | 攻击结算 | ✅ |
| 10 | S→C | `game_over` | `{ winner_id, elo_change: { p1: int, p2: int }, reason? }` | 对战结束 | ✅ |
| 11 | S→C | `timer_warning` | `{ seconds_left: int, player: "p1"\|"p2" }` | 剩余 ≤20s 警告 | ✅ |
| 12 | S→C | `turn_timeout` | `{ player, reason }` | 回合超时自动结束 | ✅ |
| 12 | S→C | `error` | `{ detail: string }` | 非法操作 | ✅ |

**game_state 结构**：
```json
{
  "turn": 1,
  "phase": "draw|main|combat|end",
  "current_player": "p1",
  "timer": 100,
  "timer_remaining": 87,
  "turn_deadline_ts": 1717843200.5,
  "match_elapsed": 245,
  "game_over": false,
  "winner": null,
  "viewer": "p1",
  "opponent": "p2",
  "players": {
    "p1": {
      "hp": 30, "max_hp": 30, "ink": 3, "max_ink": 3,
      "hand": [{ "uid": "inst1", "card_id": "card_001", "name": "...", "power": 3, "spirit": 2, "grit": 1, "can_attack": false }],
      "front_line": [{ "uid": "...", "card_id": "...", "power": 3, "spirit": 2, "grit": 1, "can_attack": true }],
      "support_line": [],
      "deck_count": 20, "pen_count": 0
    },
    "p2": { "hand_count": 5, "hp": 30, ... }
  }
}
```

**play_card 说明**：`card_id` 可为手牌实例 `uid`，或卡牌定义 `id`（手牌唯一时）。

**前端接入流程**：
1. `POST /api/match/queue` `{ deck_id }`
2. 轮询 `GET /api/match/queue/status` 直至 `status === "matched"`
3. 连接 `ws://<API>/ws/game/{match_id}`（Token 通过 Subprotocol 传递）
4. 发送 `{ "event": "join_match", "payload": { "match_id": "..." } }`
5. 监听 `game_state` / `turn_start` / `game_over`

**回合流程**：draw(抽牌) → main(出牌+布阵) → combat(攻击结算) → end(回合切换)

---

### 4.12 API 实现状态总览

| 模块 | 已实现 | 未实现 | 完成度 |
|------|--------|--------|--------|
| Auth | 8/8 | — | 100% |
| Cards | 2/2 | — | 100% |
| Collection | 5/5 | — | 100% |
| Decks | 6/6 | — | 100% |
| Shop | 6/6 | — | 100% |
| Checkin | 2/2 | — | 100% |
| User | 2/2 | — | 100% |
| Announcements | 2/2 | — | 100% |
| Admin | 13/13 | — | 100% |
| Leaderboard | 1/1 | — | 100% |
| **Match** | **8/8** | — | **100%** |
| **Game WS** | **12/12** | — | **100%** |
| **AI 系统** | **3/3** | — | **100%** |
| **总计** | **70/70** | **0** | **100%** |

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

### Phase 3 — 页面完善 & 交互升级 🔶 部分完成
- [ ] **3.1** 安装 Framer Motion
- [ ] **3.2** 补全 shadcn/ui: `dialog`, `toast`, `select`, `tabs`, `dropdown-menu`
- [ ] **3.3** 各路由添加 `loading.tsx` / `error.tsx`
- [ ] **3.4** 全局 Error Boundary
- [ ] **3.5** Landing 页: 动画 + 角色展示 + CTA
- [ ] **3.6** 登录/注册: 表单验证 + 错误提示
- [ ] **3.7** 卡牌图鉴: 筛选栏 + 卡牌网格 + 详情弹窗 + 稀有度动画
- [ ] **3.8** 套牌构筑: 拖拽编辑 + 卡牌搜索 + 存档提示
- [x] **3.8** 套牌构筑: 拖拽编辑 + 卡牌搜索 + 存档提示 (✅ 已完成)
- [ ] **3.9** 对战页: 匹配 + 战场 UI
- [x] **3.10** BGM/SFX 音频系统: howler.js + 场景切歌 + 首点解锁 + 设置页面滑条 (✅ 已完成)
- [x] **3.11** 设置页面: 音频音量/开关 UI → `game/settings/page.tsx` + `store/useAudioStore.ts` (✅ 已完成)

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

| ID | 问题 | 改动范围 | 状态 |
|----|------|---------|------|
| P0-1 | middleware 不保护 /game 路由 | `middleware.ts` | ✅ |
| P0-cookie | login cookie 被代理链吞掉 | 显式调 `/api/auth/set-cookie` | ✅ |
| P0-2 | Token 持久化 httpOnly cookie | `auth-context.tsx` | ✅ |
| P0-3 | API_BASE 四处硬编码收敛至 `lib/config.ts` | `lib/config.ts` + 4 处文件 | ✅ |
| P0-9 | 卡组建造器重设计 | `deck-builder/` | ✅ |
| P0-10 | 卡组建造器数据源修复 | `deck-builder/page.tsx` | ✅ |

### P1 应快修

| ID | 问题 | 根因 | 状态 |
|----|------|------|------|
| P1-4 | Zustand store 拆分 | `store/useAuthStore` + `useCollectionStore` + `useDeckStore` | ✅ |
| P1-5 | AuthGuard 客户端门控 | `middleware.ts` 不做 /game 拦截 + `auth-guard.tsx` 重定向 | ✅ 2026-06-08 |
| P1-6 | API 统一错误处理 | `lib/api.ts` formatApiDetail + `api-error.ts` | ✅ 2026-06-08 |
| P1-7 | User.role 加数据库索引 | backend alembic migration | ✅ 已有 `index=True` |
| P1-8 | Redis 配置决策(删或实现) | `backend/app/core/config.py` | ⬜ |
| P1-11 | 大厅背景图跟随侧边栏 | `game/layout.tsx` | ✅ |
| P1-12 | 图片缓存/加载优化 | `next.config.mjs` | ✅ |
| P1-14 | 卡牌图鉴"总计0张" | backend seed + frontend | ✅ |
| P1-15 | 卡牌升级系统 | collection upgrade API | ✅ |
| P1-16 | 卡牌详情 | `card-detail-modal.tsx` | ✅ |
| P1-17 | Admin stats 字段对齐 | `admin/page.tsx` ↔ `api/admin.py` | ✅ 2026-06-08 |
| P1-18 | 卡组类型大小写 | `deck-builder/page.tsx` getCategory | ✅ 2026-06-08 |
| P1-19 | 双轨认证不同步 | 统一 `useAuth()` 管理墨水/头像 | ✅ 2026-06-08 |
| P1-20 | JWT UTC NameError | `backend/app/core/security.py` | ✅ 2026-06-08 |
| P1-21 | shop.py fragment_drops 未定义变量 | `shop.py` 开包致命 NameError | ✅ 2026-06-09 |

### P1 安全加固（SEC-1~15）

| ID | 问题 | 修复 | 状态 |
|----|------|------|------|
| SEC-1 | add_to_collection 免费得卡 | 加 `_require_admin` | ✅ 2026-06-09 |
| SEC-2 | _require_current_player 空函数 | 实现防御纵深校验 | ✅ 2026-06-09 |
| SEC-3 | 无认证频率限制 | Redis 频率限制 | ✅ 2026-06-09 |
| SEC-4 | JWT 无法撤销 | token_version payload+DB | ✅ 2026-06-09 |
| SEC-5 | finalize_if_over 竞态条件 | room.lock 双重检查 | ✅ 2026-06-09 |
| SEC-6 | /set-cookie 无持有者证明 | 增加认证 | ✅ 2026-06-09 |
| SEC-7 | WS token 在 URL | 移至 Subprotocol | ✅ 2026-06-09 |
| SEC-8 | 选卡会话在进程内存 | 移至 Redis | ✅ 2026-06-09 |
| SEC-9 | 无管理员审计日志 | AdminAuditLog 表 | ✅ 2026-06-09 |
| SEC-10 | 无安全响应头 | 中间件添加 | ✅ 2026-06-09 |
| SEC-11 | 无请求体大小限制 | 1MB 上限中间件 | ✅ 2026-06-09 |
| SEC-12 | 密码强度不足 | regex 验证 | ✅ 2026-06-09 |
| SEC-13 | 效果引擎静默失败 | logger.warning | ✅ 2026-06-09 |
| SEC-14 | 卡组缺失卡牌静默跳过 | logger.warning | ✅ 2026-06-09 |
| SEC-15 | collection count 无 ge=1 校验 | Pydantic Field | ✅ 2026-06-09 |

### P2 体验优化

| # | Bug | 改动范围 | 状态 |
|---|-----|---------|------|
| P2-9 | 核心页面补齐 L1 动效 | 多个页面组件 | ⬜ |
| P2-10 | 补充复合 UI 组件 | `components/ui/` | ⬜ |
| P2-11 | .env.example + 文档 | 项目根目录 | ⬜ |
| P2-13 | 签到按钮防抖 | `checkin-banner.tsx` | ✅ 已有isLoading |
| P2-14 | 音频设置 UI（BGM/SFX 滑条） | `game/settings/page.tsx` + `store/useAudioStore.ts` | ✅ 2026-06-09 |
| P2-15 | WS 回合计时 SFX 接入 | `game/play/page.tsx` + `hooks/use-sfx.ts` | ✅ 2026-06-09 |

### P3 已发现待确认

| # | Issue | 详情 | 状态 |
|---|-------|------|------|
| P3-1 | card.py 中废弃 UserCardOut (quantity 字段) | 与 collection.py 的 UserCardOut (count 字段) 冲突 | ✅ 2026-06-09 |
| P3-2 | auth-context.tsx 直接使用 process.env.NEXT_PUBLIC_API_URL | 未统一通过 lib/config.ts 的 API_BASE | ✅ 2026-06-09 |
| P3-3 | 双测试目录混淆 | test/backend/ 内测试已迁至 backend/tests/ | ✅ 2026-06-09 |
| P3-4 | expand_cards.py 硬编码路径 | 改用相对于脚本目录的路径 | ✅ 2026-06-09 |
| P3-5 | Match history 静默跳过不存在用户的对手 | 改用占位对手「已注销」 | ✅ 2026-06-09 |
| P3-6 | Shop 开包 fragment_drops 未定义变量 | 开包 NameError 崩溃 | ✅ 2026-06-09 |
| P3-7 | test_decks.py create_deck 断言 200 应为 201 | | ✅ 2026-06-09 |
| P3-8 | battlefield.py 死代码冗余 | 删除废弃的 _is_in_zone/calc_total_spirit 等 | ✅ 2026-06-09 |
| P3-9 | auth.py PATCH /api/auth/me field_validator 误拦 | combat_style 字段验证器应跳过 | ✅ 2026-06-09 |
| P3-10 | match.py OpponentInfo 类定义顺序致 NameError | 调至引用的 Pydantic 模型之前 | ✅ 2026-06-09 |
| P3-11 | effect_engine B1: 引擎条件不匹配时静默过 | 加 logger.warning | ✅ 调试器回合 |
| P3-12 | effect_engine B2-B8: 循环/条件/属性等 | 多分支修复 | ✅ 调试器回合 |
| P3-13 | Pixabay/Mixkit 音频源 403 | 改为 Kenney + OGA CC0 源 | ✅ 2026-06-09 |

### 工作规则
1. 每个 coder task ≤ 3 文件改动，prompt 写明具体文件/API/组件名
2. coder 完成后派 review 审核
3. Blocking → 重修，Warning → 记录继续，Approved → 下一个
4. **Phase 0 ✅ → Phase 1 → Phase 2**，按序推进

---

## 七、目标目录结构

```
frontend/
├── public/audio/               ← CC0 BGM + SFX 文件
│   ├── lobby-bgm.mp3
│   ├── battle-bgm.mp3
│   ├── cardPlay.ogg
│   ├── attack.ogg
│   ├── uiClick.ogg
│   ├── victory.ogg
│   ├── defeat.ogg
│   ├── powerUp.ogg
│   └── coin.wav
└── src/
    ├── app/
    │   ├── layout.tsx              ← 根布局 (QueryClient + Auth + BgmPlayer)
    │   ├── globals.css             ← Tailwind + CSS vars
    │   ├── page.tsx                ← Landing
    │   ├── auth/
    │   ├── game/
    │   │   ├── layout.tsx          ← 游戏导航布局
    │   │   ├── settings/           ← 设置（含音频滑条）
    │   │   ├── collection/
    │   │   ├── deck-builder/
    │   │   └── play/               ← 对战（含 SFX 接入）
    │   └── admin/
    ├── components/
    │   ├── bgm-player.tsx          ← 场景自动切歌 + 首点解锁
    │   ├── ui/                     ← shadcn/ui 组件
    │   └── game/                   ← 游戏专用组件
    ├── hooks/
    │   ├── use-bgm.ts              ← BGM Howl 生命周期
    │   ├── use-sfx.ts              ← SFX 缓存 + 播放
    │   └── use-turn-timer.ts
    ├── lib/
    │   ├── api.ts / config.ts / auth-context.tsx / game-ws.ts
    │   └── utils.ts
    ├── store/                      ← Zustand stores
    │   ├── useAudioStore.ts        ← 音量/开关/场景持久化
    │   ├── useMatchStore.ts
    │   └── ...
    ├── middleware.ts               ← 仅 root→login 重定向
    └── types/                      ← TypeScript 类型定义
```

---

## 八、部署 & 运维

### 架构

| 组件 | 服务器 | 端口 | 域名 |
|------|--------|------|------|
| 后端 FastAPI | 后端服务器 (systemd) | `127.0.0.1:8000` | API 域名 (Nginx 反向代理) |
| 前端 Next.js | 前端服务器 (systemd) | `:3000` (standalone) | 前端域名 (Nginx 反向代理) |
| 数据库 PostgreSQL | 后端服务器 (systemd) | `localhost:5432` | — |
| 缓存 Redis | 后端服务器 (systemd) | `localhost:6379` | — |

### 自动部署

```bash
# 交互式部署（推荐）
sudo bash deploy/deploy.sh

# 非交互一键部署（CI/cron）
bash deploy/server/deploy.sh
```

部署脚本自动执行：拉代码 → 安装依赖（uv 或 pip）→ 构建前端 → 复制 standalone 静态资源 → 迁移版本检查 + upgrade → 重启服务。

详细说明见 [`deploy/README.md`](deploy/README.md)。

### 手动部署

#### 后端

```bash
cd /opt/campuskards          # 替换为实际项目路径
git pull origin main
sudo bash deploy/deploy-backend.sh
```

#### 前端

```bash
cd /opt/campuskards
git pull origin main
sudo bash deploy/deploy-frontend.sh
```

### systemd Service 文件

```
deploy/server/
├── campuskards-backend.service.example
├── campuskards-frontend.service.example
├── install-services.sh             # 安装并替换 __PROJECT_ROOT__
├── deploy.sh                       # 非交互一键部署
├── backup.sh                       # DB 备份（保留 7 天）
└── .env.example                    # 环境变量模板
```

### Service 配置要点

- **后端**：`uvicorn` 4 workers，`--timeout-keep-alive 30` 防止 502
- **前端**：Next.js `output: "standalone"`，运行 `server.js`；构建后需复制 `.next/static` 和 `public/`（含 `public/audio/` 音频文件）
- **健康检查**：`GET /health` 返回 DB + Redis 状态
- **数据库备份**：`backup.sh` 每日 `pg_dump` → 压缩 → 保留 7 天
- **旧库迁移**：首次升级需 `alembic stamp <revision>` 标记当前 schema 版本

### 日志查看

```bash
# 后端
sudo journalctl -u campuskards-backend -f --no-pager -n 50

# 前端
sudo journalctl -u campuskards-frontend -f --no-pager -n 50

# Nginx
sudo tail -f /var/log/nginx/access.log
```

### 流程：代码从本地推送到生产

```
本地 → Git 远程仓库 (git push) → 后端服务器 (git pull + bash deploy/deploy.sh)
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

*最后更新: 2026-06-09 (v2 — 加入音频系统、Bug 清单扩展、目录更新)*
