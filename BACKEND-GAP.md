# CampusKards - 前后端 API 差异分析

> 最后更新：2026-06-09  
> **所有 API 前后端已对齐，无已知缺口。** 本文档存档历史分析结论。

## 全部 API 模块状态（100% 完成）

| 模块 | 状态 | 端点计数 |
|------|------|---------|
| Auth | ✅ | 8 |
| Cards | ✅ | 2 |
| Collection | ✅ | 5 |
| Decks | ✅ | 6 |
| Shop | ✅ | 6 |
| Checkin | ✅ | 2 |
| User | ✅ | 2 |
| Announcements | ✅ | 2 |
| Admin | ✅ | 13 |
| Leaderboard | ✅ | 1 |
| Match (REST) | ✅ | 8 |
| Game WebSocket | ✅ | 12 事件 |
| AI 系统 | ✅ | 3 |
| **总计** | **100%** | **70** |

详见 `DEVELOPMENT.md` 第四章完整 API 规格。

### 已实现的 v1 对战引擎

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
- **PVE / 单人练习模式** ✅
- **AI 自动补位**（快速队列匹配超时后）

### WS 事件（12 个全部实现）

`join_match` · `play_card` · `attack` · `end_turn` · `use_ability` · `resolve_choice` · `resolve_discard` · `move_unit` · `game_state` · `turn_start` · `card_played` · `attack_result` · `game_over` · `timer_warning` · `turn_timeout` · `error`

### P2 增强（可选）

- 多 worker 对战广播（Redis Pub/Sub）
- 逐步回放 UI（后端已有 log/snapshot）
- 非单位卡升级 +10%/级 的法术数值缩放（等级已进战场单位属性）
- Redis session / token 黑名单
- Rate limiting
- 完全 Cookie-only 认证
