# 派系协同加成设计文档

## 概述

派系协同加成是CampusKards的核心机制之一，鼓励玩家构建具有派系特色的卡组。当场上单位满足特定派系组合条件时，触发协同效果，增强战略深度。

## 五大派系协同效果

### 1. 精英班 (Elite) - "学术精英"
**触发条件**: 场上有2个或以上精英班单位
**协同效果**: 所有精英班单位获得 +1 Power
**设计理念**: 精英班强调质量优势，少量精英单位即可形成强大战斗力。

### 2. 艺术班 (Arts) - "创意风暴"
**触发条件**: 场上有3个或以上艺术班单位
**协同效果**: 所有艺术班单位获得 +1 Spirit（额外生命值）
**设计理念**: 艺术班注重持久战和创意表达，通过数量积累获得生存优势。

### 3. 普通班 (Mass) - "团结就是力量"
**触发条件**: 场上有4个或以上普通班单位
**协同效果**: 所有普通班单位获得 +1 Power 和 +1 Spirit
**设计理念**: 普通班走人海战术路线，大量低费单位协同作战。

### 4. 国际班 (Global) - "多元融合"
**触发条件**: 场上有2个或以上国际班单位，且至少1个其他派系单位
**协同效果**: 所有国际班单位获得 +1 Power，其他派系单位获得 +1 Spirit
**设计理念**: 国际班鼓励混合卡组，促进派系间的文化交流。

### 5. 竞赛班 (Rush) - "极限突破"
**触发条件**: 场上有1个或以上竞赛班单位，且本回合已攻击过2次
**协同效果**: 所有竞赛班单位获得 +2 Power（持续到回合结束）
**设计理念**: 竞赛班强调快速攻击和节奏控制，越战越勇。

## 实现方案

### 后端实现 (game_engine.py)

```python
def _apply_faction_synergies(self) -> None:
    """应用派系协同加成"""
    for player_id in [1, 2]:
        field = self.battlefield.get_field(player_id)
        
        # 统计各派系单位数量
        faction_counts = {}
        for unit in field.front_line + field.back_line:
            faction_counts[unit.faction] = faction_counts.get(unit.faction, 0) + 1
        
        # 统计本回合攻击次数
        attacks_this_turn = sum(1 for log in self.log 
                               if log['player_id'] == player_id 
                               and log['action'] == 'attack'
                               and log['turn'] == self.turn_number)
        
        # 应用协同效果
        all_units = field.front_line + field.back_line
        for unit in all_units:
            # Elite: 2+ units -> +1 Power
            if unit.faction == 'elite' and faction_counts.get('elite', 0) >= 2:
                unit.add_buff('power', 1, 'elite_synergy')
            
            # Arts: 3+ units -> +1 Spirit
            if unit.faction == 'arts' and faction_counts.get('arts', 0) >= 3:
                unit.add_buff('spirit', 1, 'arts_synergy')
            
            # Mass: 4+ units -> +1 Power, +1 Spirit
            if unit.faction == 'mass' and faction_counts.get('mass', 0) >= 4:
                unit.add_buff('power', 1, 'mass_synergy_power')
                unit.add_buff('spirit', 1, 'mass_synergy_spirit')
            
            # Global: 2+ global + 1+ other -> +1 Power to global, +1 Spirit to others
            if unit.faction == 'global' and faction_counts.get('global', 0) >= 2:
                has_other = any(f != 'global' for f in faction_counts.keys())
                if has_other:
                    unit.add_buff('power', 1, 'global_synergy')
            elif unit.faction != 'global' and faction_counts.get('global', 0) >= 2:
                has_other = True  # 当前单位就是other
                if has_other:
                    unit.add_buff('spirit', 1, 'global_synergy')
            
            # Rush: 1+ rush + 2+ attacks this turn -> +2 Power (temp)
            if unit.faction == 'rush' and faction_counts.get('rush', 0) >= 1 and attacks_this_turn >= 2:
                unit.add_temp_buff('power', 2, 'rush_synergy', self.turn_number)
```

### 前端展示 (game-page.tsx)

```typescript
// 在单位卡片上显示协同标记
const getSynergyBadge = (unit: Unit, allUnits: Unit[], turnAttacks: number) => {
  const factionCount = allUnits.filter(u => u.faction === unit.faction).length;
  
  if (unit.faction === 'elite' && factionCount >= 2) {
    return { text: '精英协同 +1⚔️', color: 'text-purple-400' };
  }
  if (unit.faction === 'arts' && factionCount >= 3) {
    return { text: '艺术协同 +1💚', color: 'text-pink-400' };
  }
  if (unit.faction === 'mass' && factionCount >= 4) {
    return { text: '团结协同 +1⚔️+1💚', color: 'text-gray-400' };
  }
  if (unit.faction === 'global') {
    const globalCount = allUnits.filter(u => u.faction === 'global').length;
    const hasOther = allUnits.some(u => u.faction !== 'global');
    if (globalCount >= 2 && hasOther) {
      return { text: '多元协同 +1⚔️', color: 'text-cyan-400' };
    }
  }
  if (unit.faction === 'rush' && factionCount >= 1 && turnAttacks >= 2) {
    return { text: '突破协同 +2⚔️', color: 'text-red-400' };
  }
  return null;
};

// 在单位卡片中渲染
const synergy = getSynergyBadge(unit, allUnits, turnAttacks);
{synergy && (
  <div className={`absolute top-0 right-0 text-[10px] ${synergy.color} font-bold bg-black/60 px-1 rounded-bl`}>
    {synergy.text}
  </div>
)}
```

## 平衡性考虑

1. **数值控制**: 协同加成幅度控制在+1~+2，避免数值膨胀
2. **触发门槛**: 各派系触发条件不同，确保卡组构筑有取舍
3. **临时效果**: Rush的加成是临时的，防止滚雪球
4. **互斥性**: 同一单位可同时享受多个协同效果（如Global+自身派系）

## 测试用例

- Elite: 2个elite单位 → +1 Power ✅
- Arts: 3个arts单位 → +1 Spirit ✅
- Mass: 4个mass单位 → +1 Power +1 Spirit ✅
- Global: 2个global + 1个elite → global单位+1 Power，elite单位+1 Spirit ✅
- Rush: 1个rush单位 + 本回合攻击2次 → +2 Power（临时）✅

## 后续扩展

- 增加更多派系特定效果（如Elite的抽牌、Arts的减费）
- 引入"反协同"机制（某些卡牌破坏敌方协同）
- 赛季特定协同规则（每赛季微调平衡）
