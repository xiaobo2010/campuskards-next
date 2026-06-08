# 战场深度扩展设计文档

## 概述

当前CampusKards战场采用2层结构（前排Front Line + 后排Back Line），战术选择有限。本设计将战场扩展为4层结构，增加战术纵深和战略复杂度。

## 4层战场结构

```
玩家2后方线 (P2 Support Line)
玩家2前线 (P2 Front Line)
    ─────────── 走廊 (Corridor) ───────────
玩家1前线 (P1 Front Line)
玩家1后方线 (P1 Support Line)
```

### 各层定义

#### 1. 前线 (Front Line)
- **位置**: 最靠近走廊的战线
- **单位上限**: 5个
- **特性**:
  - 可以近战攻击敌方前线单位
  - 可以远程攻击敌方后方线单位（如果有远程能力）
  - 承受敌方攻击的第一道防线
  - 控制走廊的前哨
- **战术意义**: 主战场，肉搏和快速反应单位的主要阵地

#### 2. 后方线 (Support Line)
- **位置**: 远离走廊的战线
- **单位上限**: 4个
- **特性**:
  - 不能被近战攻击（除非敌方有飞行/穿透能力）
  - 可以远程攻击敌方前线或后方线（如果有远程能力）
  - 提供支援效果（治疗、增益、控制）
  - 可以部署Advisor（军师）单位
- **战术意义**: 战略纵深，保护高价值单位，提供持续支援

#### 3. 走廊 (Corridor)
- **位置**: 双方前线之间的中立区域
- **特性**:
  - 不可部署单位
  - 提供全局效果（如+1墨水、抽牌机会）
  - 前线单位数量优势的一方控制走廊
  - 控制走廊可获得战略优势
- **战术意义**: 战略资源点，鼓励前线争夺

### 单位类型与位置规则

#### 近战单位 (Melee)
- **部署**: 只能部署在前线
- **攻击**: 只能攻击敌方前线单位
- **移动**: 无法移动到后方线
- **示例**: 体育生(Jock)、学霸(Grind Lord)

#### 远程单位 (Ranged)
- **部署**: 可部署在前线或后方线
- **攻击**: 可攻击敌方前线或后方线
- **移动**: 可在前线↔后方线移动（消耗1墨水）
- **示例**: 艺术生(Artist)、八卦小队(Gossip Squad)

#### 飞行单位 (Flying)
- **部署**: 可部署在前线或后方线
- **攻击**: 可攻击任何单位（无视位置）
- **移动**: 可在前线↔后方线移动（免费）
- **示例**: 特殊单位、赛季限定

#### Advisor (军师)
- **部署**: 只能部署在后方线
- **攻击**: 不可攻击
- **特性**: 提供被动增益效果
- **示例**: 纪律委员(Disciplinarian)的顾问单位

### 战斗流程调整

#### 攻击阶段
```python
def get_valid_targets(attacker: Unit, battlefield: Battlefield) -> list[Unit]:
    """根据攻击者位置和类型返回有效目标"""
    targets = []
    
    if attacker.unit_type == UnitType.MELEE:
        # 近战只能攻击敌方前线
        targets = battlefield.get_enemy_front_line(attacker.owner)
    
    elif attacker.unit_type == UnitType.RANGED:
        # 远程可攻击敌方前线或后方线
        targets = battlefield.get_enemy_front_line(attacker.owner)
        targets += battlefield.get_enemy_support_line(attacker.owner)
    
    elif attacker.unit_type == UnitType.FLYING:
        # 飞行可攻击任何敌方单位
        targets = battlefield.get_all_enemy_units(attacker.owner)
    
    return targets
```

#### 移动阶段
```python
def move_unit(self, player_id: int, unit_id: str, target_line: str) -> bool:
    """移动单位到指定战线"""
    unit = self._get_unit(player_id, unit_id)
    if not unit:
        return False
    
    # 近战单位不能移动到后方线
    if unit.unit_type == UnitType.MELEE and target_line == 'support':
        return False
    
    # 飞行单位移动免费，其他消耗1墨水
    cost = 0 if unit.unit_type == UnitType.FLYING else 1
    field = self.battlefield.get_field(player_id)
    
    if field.ink < cost:
        return False
    
    # 执行移动
    if target_line == 'front':
        if len(field.front_line) >= MAX_FRONT_LINE:
            return False
        field.support_line.remove(unit)
        field.front_line.append(unit)
    else:  # support
        if len(field.support_line) >= MAX_SUPPORT_LINE:
            return False
        field.front_line.remove(unit)
        field.support_line.append(unit)
    
    field.ink -= cost
    return True
```

#### 走廊控制
```python
def check_corridor_control(self) -> Optional[int]:
    """检查走廊控制权"""
    p1_front = len(self.battlefield.p1_field.front_line)
    p2_front = len(self.battlefield.p2_field.front_line)
    
    if p1_front > p2_front + 1:
        return 1  # 玩家1控制走廊
    elif p2_front > p1_front + 1:
        return 2  # 玩家2控制走廊
    else:
        return None  # 无人控制
```

## 实现细节

### Battlefield 类重构

```python
@dataclass
class PlayerField:
    """单个玩家的战场区域"""
    front_line: list[Unit] = field(default_factory=list)
    support_line: list[Unit] = field(default_factory=list)
    hand: list[Unit] = field(default_factory=list)
    deck: list[Unit] = field(default_factory=list)
    graveyard: list[Unit] = field(default_factory=list)
    ink: int = 0
    max_ink: int = 0
    spirit_total: int = 30
    advisor: Optional[Advisor] = None

@dataclass
class Battlefield:
    """完整战场"""
    p1_field: PlayerField = field(default_factory=PlayerField)
    p2_field: PlayerField = field(default_factory=PlayerField)
    corridor_control: Optional[int] = None  # None | 1 | 2
    
    MAX_FRONT_LINE = 5
    MAX_SUPPORT_LINE = 4
```

### 前端展示

```typescript
// 战场布局组件
<div className="flex flex-col gap-2">
  {/* 玩家2后方线 */}
  <div className="flex justify-center gap-2 bg-purple-900/20 p-2 rounded">
    {p2SupportLine.map(unit => <UnitCard key={unit.id} unit={unit} />)}
  </div>
  
  {/* 玩家2前线 */}
  <div className="flex justify-center gap-2 bg-red-900/20 p-2 rounded">
    {p2FrontLine.map(unit => <UnitCard key={unit.id} unit={unit} />)}
  </div>
  
  {/* 走廊 */}
  <div className="flex justify-center items-center h-8 bg-gradient-to-r from-blue-900/30 via-purple-900/30 to-red-900/30 rounded">
    <span className="text-xs text-gray-400">
      走廊 {corridorControl === 1 ? '(你控制)' : corridorControl === 2 ? '(对手控制)' : '(争夺中)'}
    </span>
  </div>
  
  {/* 玩家1前线 */}
  <div className="flex justify-center gap-2 bg-blue-900/20 p-2 rounded">
    {p1FrontLine.map(unit => <UnitCard key={unit.id} unit={unit} />)}
  </div>
  
  {/* 玩家1后方线 */}
  <div className="flex justify-center gap-2 bg-blue-900/20 p-2 rounded">
    {p1SupportLine.map(unit => <UnitCard key={unit.id} unit={unit} />)}
  </div>
</div>
```

## 平衡性调整

### 数值调整
- **前线单位上限**: 5个（原2层时总计7个）
- **后方线单位上限**: 4个
- **移动成本**: 1墨水（飞行单位免费）
- **走廊控制阈值**: 前线单位数量差≥2

### 战略影响
1. **增加决策复杂度**: 玩家需要决定单位部署在哪一层
2. **保护高价值单位**: 远程/辅助单位可放在后方线避免被近战攻击
3. **走廊争夺**: 鼓励前线单位数量竞争，增加战术互动
4. **移动成本**: 移动消耗墨水，防止频繁调整位置

### 反制机制
- **飞行单位**: 可攻击任何位置，克制后方线保护
- **穿透能力**: 某些近战单位可攻击后方线（如特殊卡牌）
- **范围攻击**: 事件卡可同时攻击多层单位

## 测试用例

1. **近战部署**: 近战单位只能部署在前线 ✅
2. **远程部署**: 远程单位可部署在前线或后方线 ✅
3. **近战攻击**: 近战单位只能攻击敌方前线 ✅
4. **远程攻击**: 远程单位可攻击敌方任何战线 ✅
5. **移动成本**: 普通单位移动消耗1墨水，飞行单位免费 ✅
6. **走廊控制**: 前线数量差≥2时控制走廊 ✅
7. **后方线保护**: 近战单位无法攻击敌方后方线 ✅

## 后续扩展

- **地形效果**: 不同战线有不同地形加成
- **战线技能**: 某些卡牌可改变战线规则
- **赛季地图**: 每赛季调整战线布局和规则
- **多人模式**: 扩展到4人战场（8层结构）
