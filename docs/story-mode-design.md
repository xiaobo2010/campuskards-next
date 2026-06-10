# CampusKards 故事模式 — 技术架构设计

> 版本: v1.1  
> 日期: 2026-06-10  
> 状态: 已实施

---

## 一、概述

故事模式是 CampusKards 的单人 PVE 玩法扩展。玩家在预设的章节和关卡中挑战 AI 对手，通关后获得墨水、卡牌等奖励。关卡按难度递进，支持三星评分系统。

**核心原则：最大化复用现有基础设施** — 对战引擎、AI、WebSocket、奖励系统全部零改动，只新增一个故事元数据层。

---

## 二、数据模型

### 2.1 数据库表

```sql
-- 章节定义
CREATE TABLE story_chapters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_num INT NOT NULL UNIQUE,
    title       VARCHAR(64) NOT NULL,
    subtitle    VARCHAR(128),
    description TEXT,
    cover_image VARCHAR(512),
    unlock_elo  INT DEFAULT 0,         -- 0 = 无 ELO 门槛
    sort_order  INT DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP DEFAULT now()
);

-- 关卡定义
CREATE TABLE story_levels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id      UUID NOT NULL REFERENCES story_chapters(id),
    level_num       INT NOT NULL,
    title           VARCHAR(64) NOT NULL,
    enemy_name      VARCHAR(64) NOT NULL,
    enemy_faction   VARCHAR(64) NOT NULL,
    enemy_deck_id   UUID NOT NULL REFERENCES decks(id),
    difficulty      VARCHAR(16) DEFAULT 'medium',   -- easy/medium/hard/expert
    ink_reward      INT DEFAULT 200,
    card_reward_ids JSONB DEFAULT '[]',
    special_rules   JSONB DEFAULT '{}',
    unlock_previous BOOLEAN DEFAULT true,
    max_turns       INT DEFAULT 0,                   -- 0 = 无限制
    star_conditions JSONB DEFAULT '[]',
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    UNIQUE(chapter_id, level_num)
);

-- 玩家进度
CREATE TABLE user_story_progress (
    user_id         UUID NOT NULL REFERENCES users(id),
    level_id        UUID NOT NULL REFERENCES story_levels(id),
    completed       BOOLEAN DEFAULT false,
    stars           INT DEFAULT 0,                     -- 0-3
    best_turns      INT,
    best_hp_remaining INT,
    completed_at    TIMESTAMP,
    rewards_claimed BOOLEAN DEFAULT false,
    updated_at      TIMESTAMP DEFAULT now(),
    PRIMARY KEY (user_id, level_id)
);
```

### 2.2 SQLAlchemy 模型

```python
# backend/app/models/story.py

class StoryChapter(Base):
    __tablename__ = "story_chapters"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chapter_num: Mapped[int] = mapped_column(unique=True)
    title: Mapped[str] = mapped_column(String(64))
    subtitle: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
    cover_image: Mapped[str | None] = mapped_column(String(512))
    unlock_elo: Mapped[int] = mapped_column(default=0)
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    levels: Mapped[list["StoryLevel"]] = relationship(order_by="StoryLevel.level_num")


class StoryLevel(Base):
    __tablename__ = "story_levels"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("story_chapters.id"))
    level_num: Mapped[int]
    title: Mapped[str] = mapped_column(String(64))
    enemy_name: Mapped[str] = mapped_column(String(64))
    enemy_faction: Mapped[str] = mapped_column(String(64))
    enemy_deck_id: Mapped[uuid.UUID]
    difficulty: Mapped[str] = mapped_column(String(16), default="medium")
    ink_reward: Mapped[int] = mapped_column(default=200)
    card_reward_ids: Mapped[dict] = mapped_column(JSONB, default=list)
    special_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    unlock_previous: Mapped[bool] = mapped_column(default=True)
    max_turns: Mapped[int] = mapped_column(default=0)
    star_conditions: Mapped[dict] = mapped_column(JSONB, default=list)
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)


class UserStoryProgress(Base):
    __tablename__ = "user_story_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    level_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("story_levels.id"), primary_key=True)
    completed: Mapped[bool] = mapped_column(default=False)
    stars: Mapped[int] = mapped_column(default=0)
    best_turns: Mapped[int | None]
    best_hp_remaining: Mapped[int | None]
    completed_at: Mapped[datetime | None]
    rewards_claimed: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
```

### 2.3 特殊规则 `special_rules` 设计

每关可配置以下特殊规则（JSONB 字段，全部可选）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `starting_ink` | int | 玩家初始墨水（覆盖默认 1） |
| `enemy_ink_bonus` | int | AI 额外墨水 |
| `enemy_hq_hp_bonus` | int | AI 总部额外 HP |
| `banned_factions` | list[str] | 该关禁用的势力 |
| `required_card_count` | int | 卡组最少张数（覆盖默认 30） |
| `passive_effects` | dict | 全局被动（`player`/`enemy` 文字描述） |

**示例**：
```json
{
  "starting_ink": 3,
  "enemy_ink_bonus": 2,
  "enemy_hq_hp_bonus": 15,
  "banned_factions": ["competition_class"],
  "passive_effects": {
    "player": "每回合抽两张牌",
    "enemy": "所有战斗人员力量+1"
  }
}
```

### 2.4 星级条件 `star_conditions`

```json
[
  { "desc": "获胜",           "type": "win",             "threshold": null },
  { "desc": "剩余HP≥50%",     "type": "hp_percent",      "threshold": 50 },
  { "desc": "回合数≤12",      "type": "max_turns",       "threshold": 12 }
]
```

---

## 三、后端 API

### 3.1 端点一览

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/story/chapters` | ✅ | 章节+关卡列表（含玩家进度） |
| `GET` | `/api/story/chapters/{id}` | ✅ | 单章节详情 |
| `GET` | `/api/story/levels/{id}` | ✅ | 关卡详情 |
| `POST` | `/api/story/play` | ✅ | 开始关卡对战 |
| `GET` | `/api/story/progress` | ✅ | 玩家总进度汇总 |

### 3.2 `GET /api/story/chapters` 响应

```json
{
  "chapters": [{
    "id": "uuid",
    "chapter_num": 1,
    "title": "第一章：新生报到",
    "subtitle": "踏入校园的第一步",
    "cover_image": "/images/story/ch1.png",
    "unlocked": true,
    "total_stars": 18,
    "levels": [{
      "id": "uuid",
      "level_num": 1,
      "title": "初识对决",
      "enemy_name": "体育委员-李明",
      "difficulty": "easy",
      "unlocked": true,
      "completed": true,
      "stars": 2,
      "rewards": { "ink": 200, "cards": ["card_001"] }
    }]
  }]
}
```

### 3.3 `POST /api/story/play` 请求/响应

```json
// 请求
{ "deck_id": "...", "level_id": "..." }

// 响应
{
  "status": "matched",
  "mode": "story",
  "match_id": "...",
  "level_id": "...",
  "enemy_name": "体育委员-李明",
  "enemy_faction": "arts_class",
  "difficulty": "medium",
  "star_conditions": [...],
  "special_rules": {...}
}
```

### 3.4 对战创建流程

```
POST /api/story/play {deck_id, level_id}
  → 校验 deck 有效性 + 玩家不在队列/对局中
  → 查询 StoryLevel → 获取 enemy_deck_id + difficulty + special_rules
  → 复用 ensure_pve_bot(db) 确保 Bot 存在
  → 创建 MatchTicket(
      mode="story",
      p1=user,
      p2=BOT_USER,
      p2_deck=enemy_deck_id,
      p2_elo=user.elo  → difficulty 根据此值自动推断
    )
  → 调用 _start_match(db, ticket)
    → 在 create_room 时注入 special_rules
  → 返回 match_id + 关卡元数据
```

**与 PVE 的差异**：
| 维度 | PVE | 故事模式 |
|------|-----|---------|
| 对手卡组 | 通用30张随机卡 | 关卡预置主题卡组 |
| 难度 | 玩家 ELO 自动 | 关卡固定配置 |
| 初始状态 | 默认值 | 受 special_rules 覆盖 |
| match mode | `"pve"` | `"story"` |

### 3.5 对战完成回调

```
game_over WebSocket 事件到达前端
  → 前端计算星级
  → POST /api/story/complete {match_id, level_id, stars, best_turns, best_hp_remaining}
  → 后端更新 UserStoryProgress
  → 若首通: 发放 ink_reward + card_reward_ids
  → 若解锁下一关: 前端在章节地图上看到新解锁节点
```

---

## 四、AI 对手卡组

每个关卡的 AI 对手使用**预设卡组**，而非通用随机卡组。

### 4.1 种子数据格式

```python
# backend/app/services/story_bot_decks.py

STORY_BOT_DECKS = {
    "ch1_l1": {
        "name": "新生对手-基础班",
        "username": "同学-小张",
        "faction": "key_class",
        "difficulty": "easy",
        "cards": [
            ("card_001", 3),  # 课代表
            ("card_002", 2),  # 学习委员
            ("card_005", 1),  # ...
        ]
    },
    "ch1_boss": {
        "name": "学生会长-周浩",
        "username": "学生会长-周浩",
        "faction": "competition_class",
        "difficulty": "hard",
        "cards": [
            ("card_legendary_001", 1),
            ("card_rare_010", 2),
        ]
    },
}
```

### 4.2 种子脚本

部署时运行 `python -m app.services.story_seed` 完成：
1. 创建 `story_chapters` 和 `story_levels` 行
2. 为每个关卡创建专属 Bot 用户 + Bot 卡组
3. 关联 `enemy_deck_id` 到 `story_levels`

使用固定 UUID 确保幂等（重复运行不重复创建）。

---

## 五、前端路由与页面

### 5.1 路由结构

```
src/app/game/story/
├── page.tsx                          ← 章节总览
├── [chapterId]/
│   └── page.tsx                      ← 关卡地图
│       └── [levelId]/
│           └── page.tsx              ← 战前准备
```

### 5.2 `/game/story` — 章节总览

- 横向滚动或网格布局，每章一张卡片
- 卡片内容：封面图、章节标题、进度条（已完成 X/Y 关）、星数
- 未解锁章节（ELO 不足或上一章未通）灰色 + 🔒 图标
- 点击已解锁章节 → `/game/story/{chapterId}`

### 5.3 `/game/story/{chapterId}` — 关卡地图

- 垂直排列的关卡节点路径
- 节点三种状态：
  - 🔒 未解锁
  - ⚔️ 已解锁未通关（显示编号 + 对手名 + 难度标签）
  - ⭐ 已通关（显示星数）
- Boss 关特殊标识（皇冠图标 + 金色边框）
- 点击未锁定节点 → `/game/story/{chapterId}/{levelId}`

### 5.4 `/game/story/{chapterId}/{levelId}` — 战前准备

- **敌人信息卡片**：名称、派系、难度徽章
- **奖励预览**：墨水数量 + 卡牌列表
- **特殊规则**：若有则红色提示
- **星级条件**：三项条件 + 检查标记
- **卡组选择**：复用 matchmaking page 的 deck selector
- **开始挑战**按钮 → `POST /api/story/play` → 跳转 `/game/play?match_id=...`

### 5.5 对战结果屏幕集成

对局结束后的 `game_over` payload 中 `mode === "story"` 时，`battle-result-screen` 组件额外渲染：
- 三星评分展示
- "再来一次" / "下一关" 按钮
- 首通奖励动画

### 5.6 新增前端类型

```typescript
// src/types/index.ts 追加

export interface StoryChapter {
  id: string;
  chapter_num: number;
  title: string;
  subtitle?: string | null;
  cover_image?: string | null;
  unlocked: boolean;
  total_levels: number;
  completed_levels: number;
  total_stars: number;
  levels: StoryLevelSummary[];
}

export interface StoryLevelSummary {
  id: string;
  level_num: number;
  title: string;
  enemy_name: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  unlocked: boolean;
  completed: boolean;
  stars: number;
  rewards: { ink: number; cards: string[] };
}

export interface StoryLevelDetail extends StoryLevelSummary {
  enemy_faction: string;
  special_rules: StorySpecialRules;
  star_conditions: StarCondition[];
  max_turns: number;
}

export interface StorySpecialRules {
  starting_ink?: number;
  enemy_ink_bonus?: number;
  enemy_hq_hp_bonus?: number;
  banned_factions?: string[];
  passive_effects?: { player?: string; enemy?: string };
}

export interface StarCondition {
  desc: string;
  type: "win" | "hp_percent" | "max_turns" | "no_unit_deaths";
  threshold?: number | null;
}

export interface StoryPlayResponse {
  status: string;
  mode: "story";
  match_id: string;
  level_id: string;
  enemy_name: string;
  enemy_faction: string;
  difficulty: string;
  star_conditions: StarCondition[];
  special_rules: StorySpecialRules;
}

export interface StoryProgress {
  total_levels: number;
  completed_levels: number;
  total_stars: number;
  chapters_completed: number;
}
```

### 5.7 侧边栏集成

```typescript
// sidebar.tsx PLAYER_NAV_ITEMS 新增 (插入在 "开始对战" 之前)
{ href: "/game/story", label: "故事模式", icon: Map },

// mobile-header.tsx navItems 同样新增
```

---

## 六、文件清单

| 层 | 文件 | 内容 |
|----|------|------|
| **Model** | `backend/app/models/story.py` | 3 个 SQLAlchemy 模型 |
| **Schema** | `backend/app/schemas/story.py` | Pydantic 请求/响应 schema |
| **API** | `backend/app/api/story.py` | 6 个 REST 端点 |
| **Service** | `backend/app/services/story_bot_decks.py` | Bot 卡组配置数据 |
| **Seed** | `backend/app/services/story_seed.py` | 初始数据种子脚本 |
| **Migration** | `backend/alembic/versions/xxx_story_tables.py` | 建表迁移 |
| **Config** | `backend/app/main.py` | 注册 story_router |
| **Frontend Types** | `frontend/src/types/index.ts` | 新增故事模式类型 |
| **API Client** | `frontend/src/lib/api.ts` | `storyApi` 方法 |
| **Store** | `frontend/src/store/useStoryStore.ts` | Zustand 故事进度 |
| **Pages** | `frontend/src/app/game/story/page.tsx` | 章节总览 |
| | `frontend/src/app/game/story/[chapterId]/page.tsx` | 关卡地图 |
| | `frontend/src/app/game/story/[chapterId]/[levelId]/page.tsx` | 战前准备 |
| **Components** | `frontend/src/components/game/story/chapter-card.tsx` | 章节卡片 |
| | `frontend/src/components/game/story/level-node.tsx` | 关卡节点 |
| | `frontend/src/components/game/story/story-result.tsx` | 故事结算屏 |
| **Navigation** | `frontend/src/components/game/sidebar.tsx` | +故事模式 导航项 |
| | `frontend/src/components/game/mobile-header.tsx` | +故事模式 导航项 |

---

## 七、分阶段实施计划

| 阶段 | 内容 | 关键文件 |
|------|------|---------|
| **Phase 1** 数据层 | 模型、Alembic 迁移、Seed 脚本、Pydantic schema | `models/story.py`, `schemas/story.py`, `services/story_seed.py` |
| **Phase 2** API 层 | 6 个 REST 端点 + 注册路由 + story bot decks | `api/story.py`, `services/story_bot_decks.py`, `main.py` |
| **Phase 3** 前端基础 | 类型定义、API client、store、侧边栏 | `types/index.ts`, `lib/api.ts`, `store/useStoryStore.ts` |
| **Phase 4** 前端页面 | 章节页 + 关卡地图 + 战前准备 UI | `app/game/story/` 三个页面 |
| **Phase 5** 前端组件 | ChapterCard、LevelNode、StoryResult 组件 | `components/game/story/` |
| **Phase 6** 对战集成 | play 页结果屏 + 星级计算 + complete 回调 | `play/page.tsx` + `battle-result-screen.tsx` |

---

## 八、向后兼容

- 现有 PVE 端点 `/api/match/pve` 不受影响
- Match 表 `mode` 字段增加新值 `"story"`，不影响已有 `"quick"/"ranked"/"pve"`
- 游戏引擎无任何改动
- AI 系统仅复用，不修改核心逻辑

---

*最后更新: 2026-06-09*
