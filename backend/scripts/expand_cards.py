import json
import random
from collections import Counter
from pathlib import Path

random.seed(42)

# Path relative to this script's directory
DATA_DIR = Path(__file__).resolve().parent
json_path = DATA_DIR / "card-data.json"

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

existing = data['cards']
existing_ids = {c['id'] for c in existing}
existing_names = {c['name'] for c in existing}

# --- Target counts ---
TARGET = {
    'faction': {'key_class': 55, 'arts_class': 50, 'normal_class': 55, 'intl_class': 50, 'competition_class': 50, 'neutral': 40},
    'type': {'unit': 204, 'command': 48, 'counter': 18, 'buff': 30},
    'rarity': {'common': 93, 'uncommon': 102, 'rare': 87, 'legendary': 18},
}

current = {
    'faction': Counter(c['faction'] for c in existing),
    'type': Counter(c['type'] for c in existing),
    'rarity': Counter(c['rarity'] for c in existing),
}

needed = {
    'faction': {k: v - current['faction'].get(k, 0) for k, v in TARGET['faction'].items()},
    'type': {k: v - current['type'].get(k, 0) for k, v in TARGET['type'].items()},
    'rarity': {k: v - current['rarity'].get(k, 0) for k, v in TARGET['rarity'].items()},
}

print("Needed counts:")
print(f"  Faction: {needed['faction']}")
print(f"  Type: {needed['type']}")
print(f"  Rarity: {needed['rarity']}")

total_needed = sum(needed['faction'].values())
print(f"  Total new cards: {total_needed}")

assert total_needed == 203, f"Expected 203 new cards, got {total_needed}"

# --- Helpers ---
PREFIX = {
    'key_class': 'kc', 'arts_class': 'ac', 'normal_class': 'nc',
    'intl_class': 'ic', 'competition_class': 'cc', 'neutral': 'ne',
}

FACTION_NAMES = {
    'key_class': ['重点班', '重点', '强化', '冲刺', '升学'],
    'arts_class': ['艺体班', '艺术', '文艺', '才艺', '特长'],
    'normal_class': ['普通班', '平凡', '日常', '大众', '平民'],
    'intl_class': ['国际班', '海外', '全球', '双语', '出国'],
    'competition_class': ['竞赛班', '竞赛', '奥赛', '精英', '天才'],
    'neutral': ['校园', '全校', '通用', '基础', '综合'],
}

# Cost distribution weights (more frequent at 2-4)
COST_WEIGHTS = {0: 2, 1: 8, 2: 18, 3: 22, 4: 20, 5: 14, 6: 9, 7: 5, 8: 2, 9: 1}

# Unit name parts per faction
UNIT_PREFIXES = {
    'key_class': ['考', '分', '题', '卷', '课', '笔', '试', '学'],
    'arts_class': ['画', '乐', '舞', '歌', '艺', '彩', '琴', '演'],
    'normal_class': ['桌', '窗', '椅', '书', '笔', '纸', '班', '校'],
    'intl_class': ['英', '外', '留', '语', '出', '世', '跨', '双'],
    'competition_class': ['竞', '赛', '奖', '冠', '牌', '智', '超', '奥'],
    'neutral': ['校', '师', '室', '场', '楼', '堂', '园', '台'],
}

UNIT_SUFFIXES = {
    'key_class': ['霸', '王', '神', '手', '狂', '魔', '侠', '圣'],
    'arts_class': ['星', '家', '师', '手', '匠', '者', '魂', '仙'],
    'normal_class': ['达', '人', '仔', '娃', '虫', '友', '君', '客'],
    'intl_class': ['者', '官', '使', '才', '生', '士', '杰', '英'],
    'competition_class': ['帝', '皇', '神', '灵', '尊', '魁', '圣', '仙'],
    'neutral': ['长', '员', '生', '工', '手', '者', '家', '师'],
}

# Non-unit name parts per faction
CMD_NAMES = {
    'key_class': ['突击测验', '模拟考试', '重点复习', '试卷讲评', '错题重做', '专项训练', '考前押题', '强化集训'],
    'arts_class': ['艺术节', '音乐会', '画展', '才艺秀', '文艺汇演', '即兴创作', '舞台彩排', '作品展'],
    'normal_class': ['大扫除', '班会课', '换座位', '听写', '课间操', '眼保健操', '自习课', '值周'],
    'intl_class': ['英语角', '模联会议', '辩论赛', '留学讲座', '文化交流', '外语节', '海外研学', '国际日'],
    'competition_class': ['竞赛辅导', '实验研究', '论文答辩', '解题大赛', '集训选拔', '学术论坛', '课题攻关', '备战集训'],
    'neutral': ['升旗仪式', '开学典礼', '运动会', '家长开放日', '消防演习', '校园开放日', '表彰大会', '社会实践'],
}

COUNTER_NAMES = {
    'key_class': ['分数排名', '重点班淘汰', '违纪处分', '成绩下滑', '降级通知', '摸底考砸'],
    'arts_class': ['演出事故', '走音警告', '颜料泼洒', '忘词危机', '灯光故障', '服装出错'],
    'normal_class': ['点名被抓', '迟到记录', '睡觉被捉', '手机没收', '作业忘带', '讲话被记'],
    'intl_class': ['签证被拒', '语言障碍', '推荐信差评', '面试翻车', '文书重写', '申请被拒'],
    'competition_class': ['竞赛失利', '实验失败', '名额被挤', '成绩被翻', '课题被拒', '资格取消'],
    'neutral': ['停课通知', '全校通报', '突击检查', '临时抽查', '纪律处分', '通报批评'],
}

BUFF_NAMES = {
    'key_class': ['题海战术', '满分秘籍', '重点笔记', '状元笔记', '冲刺打卡', '高分喷雾'],
    'arts_class': ['灵感光环', '完美音准', '创作源泉', '舞台魅力', '艺术气息', '创意工坊'],
    'normal_class': ['团结光环', '众志成城', '人海战术', '集体荣誉', '班级凝聚', '友谊之力'],
    'intl_class': ['语言天赋', '名校推荐', '全额奖学金', '交换机会', '海外视野', '国际认证'],
    'competition_class': ['天赋觉醒', '题感爆发', '决赛入场', '金牌导师', '超常发挥', '夺冠时刻'],
    'neutral': ['校训激励', '学霸光环', '幸运眷顾', '校园祝福', '青春之力', '梦想加持'],
}

FLAVOR_TEMPLATES = [
    "据说{name}每天只睡5小时——难怪在教室里从来不眨眼",
    "没有人知道{name}为什么这么强，大概是因为家里开补习班的",
    "{name}出现的时候，空气里都是粉笔灰的味道",
    "班主任说：你们要有{name}一半努力，我就退休了",
    "{name}的战绩贴在公告栏上，每次路过都有人膜拜",
    "据不完全统计，{name}一学期用掉的笔芯能绕操场三圈",
    "同学们都说{name}不是人，是行走的考试答案",
    "面对{name}的压迫感，就像面对一叠没写的暑假作业",
    "传说{name}的笔记本可以卖到全校最高价",
    "每当{name}出手，胜负就已经确定了",
    "没有人能阻止{name}，除非断网断电",
    "{name}的存在本身就是一个传说，一个关于分数的传说",
    "食堂阿姨都认识{name}，因为从来不打饭",
    "体育老师最讨厌{name}，因为体育课总被占",
    "校长办公室挂着{name}的照片——作警示用",
    "连对面的班级都在传颂{name}的威名",
    "{name}不鸣则已，一鸣惊人——主要是不鸣的时候在睡觉",
    "教务处专门为{name}设立了一个奖项",
    "听闻{name}来了，对手的笔都吓掉了",
    "{name}从不回头看爆炸——因为试卷已经改完了",
    "不是{name}太强，是对手太弱——当然{name}也确实很强",
    "据说{name}的课桌里藏着一整套模拟卷",
    "放学后{name}还在教室做题，保安都不敢赶",
    "老师批改{name}的试卷是最轻松的——因为全对",
    "同学们都希望和{name}一组——除了对手",
]

def pick_cost(rarity):
    weights = dict(COST_WEIGHTS)
    if rarity == 'common':
        weights = {c: w for c, w in weights.items() if c <= 6}
    elif rarity == 'legendary':
        weights = {c: w * 2 if c >= 5 else w // 2 for c, w in weights.items()}
    costs = list(weights.keys())
    w = [max(1, weights.get(c, 1)) for c in costs]
    return random.choices(costs, weights=w, k=1)[0]

def generate_stats(cost, rarity, card_type):
    if card_type != 'unit':
        return 0, 0, 0
    rarity_mult = {'common': 1.0, 'uncommon': 1.15, 'rare': 1.35, 'legendary': 1.6}
    mult = rarity_mult[rarity]
    base = cost * 1.8 * mult
    base += random.uniform(-0.5, 0.5)
    total = max(1, round(base))
    if cost == 0:
        total = max(1, round(random.uniform(1.5, 2.5) * mult))
    power = max(0, round(total * random.uniform(0.25, 0.45)))
    grit = max(0, round(total * random.uniform(0.2, 0.4)))
    spirit = max(1, total - power - grit)
    return power, grit, spirit

def make_ability(card_type, faction, cost, rarity):
    if card_type == 'unit':
        patterns = {
            'key_class': [
                f"入场时：抽{max(1,cost//2)}张牌",
                f"入场时：对一个敌方单位造成{max(1,cost*2//3)}点伤害",
                f"你的回合结束时：所有己方单位+{max(1,cost//3)}攻击",
                f"亡语：抽{max(1,cost//2)}张牌",
                f"入场时：若手牌≤{cost}张，获得+{max(1,cost//2)}/+{max(1,cost//2)}",
                f"入场时：对方所有单位-{max(1,cost//3)}攻击（本回合）",
            ],
            'arts_class': [
                f"「远程」。入场时：对随机敌方造成{max(1,cost//2)}点伤害",
                f"当你打出命令卡时：对敌方造成{max(1,cost*2//5)}点伤害",
                f"「远程」。回合结束时：抽{max(1,cost//4)}张牌",
                f"「闪避」。亡语：抽{max(1,cost//2)}张命令卡",
                f"「远程」。入场时：将一个敌方单位移回手牌",
                f"「远程」。攻击时：对相邻敌方单位造成{max(1,cost//3)}点伤害",
            ],
            'normal_class': [
                f"出场时：召唤1个1/1/1的「分身」",
                f"亡语：召唤{max(1,cost//2)}个1/1/1「友军」",
                f"每有一个其他己方单位，+{max(1,cost//4)}攻击",
                f"出场时：所有己方单位+{max(1,cost//3)}/+{max(1,cost//3)}（本回合）",
                f"「冲锋」。亡语：抽{max(1,cost//2)}张牌",
                f"回合结束时：若你有≥3个单位，对所有敌方造成{max(1,cost//3)}点伤害",
            ],
            'intl_class': [
                f"入场时：若手牌≥{cost}张，抽{max(1,cost//3)}张牌",
                f"入场时：抉择——抽2张牌或对敌方造成{max(1,cost//2)}点伤害",
                f"回合开始时：抽{max(1,cost//4)}张牌",
                f"入场时：获得{max(1,cost//2)}点额外费用（本回合）",
                f"「先攻」。入场时：若手牌≥{cost+1}张，获得+{max(1,cost//2)}攻击",
                f"回合结束时：若手牌≥4张，治疗自己{max(1,cost//2)}点",
            ],
            'competition_class': [
                f"「穿透」。入场时：对敌方造成{max(1,cost//2)}点伤害",
                f"「穿透」「先攻」。若场上仅有此单位，+{max(1,cost)}攻击",
                f"入场时：消灭一个费用≤{max(1,cost-2)}的敌方单位",
                f"「穿透」。亡语：对所有敌方造成{max(1,cost//2)}点伤害",
                f"场上竞赛班单位≤{max(1,cost//3)}时，获得+{max(1,cost//2)}/+{max(1,cost//2)}",
                f"「免疫」（1回合）。入场时：对敌方造成{max(1,cost)}点伤害",
            ],
            'neutral': [
                f"入场时：抽1张牌",
                f"入场时：对所有敌方单位造成{max(1,cost//3)}点伤害",
                f"回合结束时：治疗一个己方单位{max(1,cost//2)}点",
                f"亡语：抽{max(1,cost//3)}张牌",
                f"「空军」。入场时：对随机敌方造成{max(1,cost//2)}点伤害",
                f"入场时：获得{max(1,cost//3)}/+{max(1,cost//3)}",
            ],
        }
        return random.choice(patterns.get(faction, patterns['neutral']))
    elif card_type == 'command':
        cmd_patterns = {
            'key_class': [
                f"抽{max(2,cost)}张牌",
                f"所有己方单位+{max(1,cost//2)}攻击（本回合）",
                f"对任意目标造成{max(2,cost+1)}点伤害",
                f"从牌库搜索1张费用≤{max(1,cost-1)}的卡加入手牌",
            ],
            'arts_class': [
                f"对任意目标造成{max(2,cost+1)}点伤害",
                f"所有「远程」单位+{max(2,cost)}攻击（本回合）",
                f"将一个敌方单位移回对手手牌",
                f"本回合下一张命令卡费用-{max(1,cost//2)}",
            ],
            'normal_class': [
                f"召唤{max(1,cost-1)}个1/1/1的「友军」",
                f"所有费用≤{max(1,cost-1)}的己方单位+{max(1,cost//2)}/+{max(1,cost//2)}",
                f"抽{max(1,cost-1)}张牌",
                f"选择：抽2张牌或召唤2个1/1/1「友军」",
            ],
            'intl_class': [
                f"抽{max(2,cost//2+1)}张牌。若手牌≥5，再抽1张",
                f"本回合下一张卡费用-{max(1,cost//2)}",
                f"抽{max(1,cost-1)}张牌，其中至少1张为命令卡",
                f"获得{max(1,cost//2)}点额外费用（本回合）",
            ],
            'competition_class': [
                f"从牌库搜索1张竞赛班单位卡加入手牌",
                f"使一个竞赛班单位+{max(2,cost)}/+{max(2,cost)}（本回合）",
                f"对任意目标造成{max(3,cost+2)}点伤害",
                f"所有己方单位获得「穿透」（本回合）",
            ],
            'neutral': [
                f"所有费用≤{max(1,cost//2)}的单位+{max(1,cost//3)}攻击（本回合）",
                f"消灭所有攻击力≤{max(1,cost-2)}的单位",
                f"抽{max(1,cost//2)}张牌",
                f"对所有敌方造成{max(1,cost-1)}点伤害",
            ],
        }
        return random.choice(cmd_patterns.get(faction, cmd_patterns['neutral']))
    elif card_type == 'counter':
        counter_patterns = {
            'key_class': [
                f"当对手打出费用≥{max(2,cost)}的卡时触发：使其费用+2并返回手牌",
                f"当对手抽牌时触发：对其造成{max(1,cost//2)}点伤害",
                f"当对手打出单位卡时触发：使其-{max(1,cost//2)}/-{max(1,cost//2)}",
            ],
            'arts_class': [
                f"当敌方单位攻击时触发：使其攻击力减半（本回合）",
                f"当对手打出命令卡时触发：取消该命令并造成{max(1,cost//2)}点伤害",
                f"当对手打出单位卡时触发：将其移回手牌",
            ],
            'normal_class': [
                f"当对手打出单位卡时触发：召唤1个1/1/1「吃瓜群众」",
                f"当对手攻击时触发：阻止该攻击并对其造成{max(1,cost//2)}点伤害",
                f"当对手打出卡时触发：抽1张牌",
            ],
            'intl_class': [
                f"当对手打出费用≥{max(3,cost+1)}的卡时触发：使其费用+3",
                f"当对手抽牌时触发：你抽1张牌",
                f"当对手打出buff时触发：取消该效果并抽1张牌",
            ],
            'competition_class': [
                f"当对手打出单位卡时触发：若费用≥你场上单位数×2，消灭之",
                f"当对手打出卡时触发：使其-{max(1,cost//2)}/-{max(1,cost//2)}",
                f"当对手攻击时触发：使攻击单位返回手牌",
            ],
            'neutral': [
                f"当对手打出费用≥{max(3,cost+1)}的卡时触发：取消之",
                f"当对手打出单位卡时触发：对所有敌方造成{max(1,cost//2)}点伤害",
                f"当对手抽牌时触发：弃1张牌",
            ],
        }
        return random.choice(counter_patterns.get(faction, counter_patterns['neutral']))
    elif card_type == 'buff':
        buff_patterns = {
            'key_class': [
                f"使一个单位+{max(1,cost//2)}/+{max(1,cost//2)}。若手牌≤2，额外+1/+1",
                f"使一个单位获得「先攻」和+{max(2,cost)}攻击（本回合）",
                f"使一个单位永久+{max(1,cost//2)}攻击",
            ],
            'arts_class': [
                f"使一个「远程」单位+{max(2,cost)}攻击和「先攻」",
                f"使一个单位+{max(1,cost//2)}/+{max(1,cost//2)}并获得「闪避」",
                f"使一个单位永久获得「远程」和+{max(1,cost//3)}防御",
            ],
            'normal_class': [
                f"使一个单位+{max(1,cost//2)}/+{max(1,cost//2)}。召唤1个1/1/1友军",
                f"所有费用≤{max(1,cost-1)}单位+{max(1,cost//2)}/+{max(1,cost//2)}",
                f"使一个单位获得「亡语：召唤1个1/1/1友军」",
            ],
            'intl_class': [
                f"使一个单位+{max(1,cost//2)}/+{max(1,cost//2)}。若手牌≥5，抽1张牌",
                f"使一个单位获得「先攻」和+{max(2,cost)}攻击",
                f"使一个单位永久+{max(1,cost//3)}/+{max(1,cost//3)}并抽1张牌",
            ],
            'competition_class': [
                f"使一个竞赛班单位永久+{max(2,cost)}攻击",
                f"使一个单位获得「穿透」和+{max(1,cost//2)}/+{max(1,cost//2)}",
                f"使一个竞赛班单位获得「免疫」（1回合）和+{max(1,cost//2)}/+{max(1,cost//2)}",
            ],
            'neutral': [
                f"使一个单位+{max(1,cost//2)}/+{max(1,cost//2)}",
                f"使一个单位获得+{max(1,cost//2)}攻击和「威慑」",
                f"所有己方单位+{max(1,cost//3)}防御（持续2回合）",
            ],
        }
        return random.choice(buff_patterns.get(faction, buff_patterns['neutral']))

def generate_name_and_id(faction, card_type, used_ids, used_names, id_counter):
    prefix = PREFIX[faction]
    if card_type == 'unit':
        name_parts = [
            random.choice(UNIT_PREFIXES[faction]),
            random.choice(UNIT_SUFFIXES[faction]),
        ]
        if random.random() < 0.4:
            adj = random.choice(['大', '小', '超级', '无敌', '终极', '初级', '首席', '王牌', '铁血', '冷面', '热血', '佛系', '暴躁'])
            name = adj + ''.join(name_parts)
        else:
            name = ''.join(name_parts)
    elif card_type == 'command':
        name = random.choice(CMD_NAMES[faction])
    elif card_type == 'counter':
        name = random.choice(COUNTER_NAMES[faction])
    else:
        name = random.choice(BUFF_NAMES[faction])

    # Ensure unique name
    while name in used_names:
        if card_type == 'unit':
            name = random.choice(UNIT_PREFIXES[faction]) + random.choice(UNIT_SUFFIXES[faction])
            if random.random() < 0.3:
                name = random.choice(['大', '小', '超级', '无敌', '终极']) + name
        elif card_type == 'command':
            name += '·改'
        elif card_type == 'counter':
            name += '·再现'
        else:
            name += '·续'

    # Generate ID
    type_key = card_type
    counter = id_counter.setdefault((faction, type_key), 1)
    cid = f"{prefix}_{type_key}_{counter:03d}"
    while cid in used_ids:
        counter += 1
        cid = f"{prefix}_{type_key}_{counter:03d}"
    id_counter[(faction, type_key)] = counter + 1

    return name, cid

def generate_flavor(name):
    return random.choice(FLAVOR_TEMPLATES).replace('{name}', name)

# --- Build the card generation plan ---
faction_needed = {k: v for k, v in needed['faction'].items()}
type_needed = {k: v for k, v in needed['type'].items()}
rarity_needed = {k: v for k, v in needed['rarity'].items()}

# Allocate cards to (faction, type, rarity) combinations
plan = []
available_combos = [(f, t, r) for f in faction_needed for t in type_needed for r in rarity_needed]

while sum(faction_needed.values()) > 0:
    # Pick faction with highest remaining need
    factions_sorted = sorted(faction_needed.items(), key=lambda x: -x[1])
    faction = None
    for f, n in factions_sorted:
        if n > 0:
            faction = f
            break
    if not faction:
        break

    # Pick type with highest proportion remaining
    types_ratio = {}
    for t, n in type_needed.items():
        if n > 0:
            target_prop = TARGET['type'][t] / 300
            current_prop = (TARGET['type'][t] - n) / (300 - sum(faction_needed.values()) + 1)
            types_ratio[t] = target_prop - current_prop
    card_type = max(types_ratio, key=types_ratio.get)

    # Pick rarity
    rarities_ratio = {}
    for r, n in rarity_needed.items():
        if n > 0:
            target_prop = TARGET['rarity'][r] / 300
            current_prop = (TARGET['rarity'][r] - n) / (300 - sum(faction_needed.values()) + 1)
            rarities_ratio[r] = target_prop - current_prop
    rarity = max(rarities_ratio, key=rarities_ratio.get)

    plan.append((faction, card_type, rarity))
    faction_needed[faction] -= 1
    type_needed[card_type] -= 1
    rarity_needed[rarity] -= 1

print(f"\nPlan generated: {len(plan)} cards")
assert len(plan) == 203, f"Expected 203, got {len(plan)}"

# Verify counts
from collections import Counter
plan_f = Counter(p[0] for p in plan)
plan_t = Counter(p[1] for p in plan)
plan_r = Counter(p[2] for p in plan)
print(f"Plan faction: {dict(plan_f)}")
print(f"Plan type: {dict(plan_t)}")
print(f"Plan rarity: {dict(plan_r)}")

# --- Generate cards ---
id_counter = {}

# Initialize counters based on existing cards
for c in existing:
    parts = c['id'].rsplit('_', 1)
    if len(parts) == 2:
        id_base, num_str = parts
        if num_str.isdigit():
            num = int(num_str)
            # Extract faction prefix and type
            pf = c['id'].split('_')[0]
            # Determine the type key from the id pattern
            # Existing IDs: {prefix}_{subtype}_{num} for units, {prefix}_cmd_{num} etc for non-units
            type_part = '_'.join(c['id'].split('_')[1:-1])
            # Map to our type categories
            if type_part in ('student', 'sports', 'scholar', 'discipline', 'broadcast'):
                key = (c['faction'], 'unit')
            elif type_part == 'cmd':
                key = (c['faction'], 'command')
            elif type_part == 'counter':
                key = (c['faction'], 'counter')
            elif type_part == 'buff':
                key = (c['faction'], 'buff')
            else:
                key = (c['faction'], 'unit')
            if key not in id_counter or num >= id_counter[key]:
                id_counter[key] = num + 1

new_cards = list(existing)

for faction, card_type, rarity in plan:
    name, cid = generate_name_and_id(faction, card_type, existing_ids, existing_names, id_counter)
    existing_ids.add(cid)
    existing_names.add(name)

    cost = pick_cost(rarity)
    power, grit, spirit = generate_stats(cost, rarity, card_type)

    # Subtype
    if card_type == 'unit':
        subtype = random.choice(['student', 'sports', 'scholar', 'discipline', 'broadcast'])
    else:
        subtype = None

    ability = make_ability(card_type, faction, cost, rarity)
    flavor = generate_flavor(name)

    card = {
        'id': cid,
        'name': name,
        'faction': faction,
        'type': card_type,
        'subtype': subtype,
        'cost': cost,
        'attack': power,
        'defense': grit,
        'hp': spirit,
        'ability': ability,
        'rarity': rarity,
        'flavor': flavor,
    }
    new_cards.append(card)

print(f"\nTotal cards after generation: {len(new_cards)}")

# --- Verify ---
final_f = Counter(c['faction'] for c in new_cards)
final_t = Counter(c['type'] for c in new_cards)
final_r = Counter(c['rarity'] for c in new_cards)

print(f"\nFinal distribution:")
print(f"  Faction: {dict(final_f)}")
for k, v in TARGET['faction'].items():
    print(f"    {k}: {final_f.get(k,0)} (target {v})")
print(f"  Type: {dict(final_t)}")
for k, v in TARGET['type'].items():
    print(f"    {k}: {final_t.get(k,0)} (target {v})")
print(f"  Rarity: {dict(final_r)}")
for k, v in TARGET['rarity'].items():
    print(f"    {k}: {final_r.get(k,0)} (target {v})")

# Check for duplicate names/IDs
all_ids = [c['id'] for c in new_cards]
all_names = [c['name'] for c in new_cards]
assert len(all_ids) == len(set(all_ids)), "Duplicate IDs!"
assert len(all_names) == len(set(all_names)), "Duplicate names!"

# Verify non-unit cards have 0 stats
for c in new_cards:
    if c['type'] != 'unit':
        assert c['attack'] == 0 and c['defense'] == 0 and c['hp'] == 0, \
            f"Non-unit card {c['id']} has non-zero stats"

# Save
data['cards'] = new_cards
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nSaved! Total cards: {len(new_cards)}")
