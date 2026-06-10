#!/usr/bin/env python3
"""Expand card-data.json from ~304 to ~500 cards with active abilities."""

import json
import sys
from pathlib import Path

FILE = Path(__file__).resolve().parent / "card-data.json"

# ─── All new cards, organized by faction ───
# Format matches the old schema (faction, type, subtype, attack, defense, hp, ability, flavor)
# so the existing seed_cards.py transform works without changes.
# Active abilities use the "主动：...（冷却 N）" syntax.

NEW_CARDS = [
    # ═══════════════════════════════════════════
    # key_class (重点班) — 35 new cards
    # Identity: hand-size synergy, precision, discipline
    # ═══════════════════════════════════════════
    
    # -- student units --
    {"id": "kc_student_005", "name": "刷题机器人", "faction": "key_class", "type": "unit", "subtype": "student", "cost": 1, "attack": 2, "defense": 1, "hp": 2, "ability": "主动：本回合+2攻击（冷却 1）", "rarity": "common", "flavor": "代码写得比情书还长"},
    {"id": "kc_student_006", "name": "错题本收集者", "faction": "key_class", "type": "unit", "subtype": "student", "cost": 3, "attack": 3, "defense": 1, "hp": 3, "ability": "出场时：若手牌≤2张，抽2张牌", "rarity": "uncommon", "flavor": "每一道错题都是通往清北的垫脚石"},
    {"id": "kc_student_007", "name": "晚自习监察员", "faction": "key_class", "type": "unit", "subtype": "student", "cost": 4, "attack": 3, "defense": 2, "hp": 5, "ability": "双方手牌上限-1（不可叠加）", "rarity": "rare", "flavor": "「交手机，不许说话，不许传纸条」"},
    
    # -- sports units --
    {"id": "kc_sports_003", "name": "早操领跑员", "faction": "key_class", "type": "unit", "subtype": "sports", "cost": 1, "attack": 1, "defense": 1, "hp": 3, "ability": "「冲锋」", "rarity": "common", "flavor": "六点半，操场见"},
    {"id": "kc_sports_004", "name": "体能强化班", "faction": "key_class", "type": "unit", "subtype": "sports", "cost": 5, "attack": 5, "defense": 2, "hp": 5, "ability": "主动：获得「穿透」直到回合结束（冷却 2）", "rarity": "rare", "flavor": "跑完五千米再来十组蛙跳"},
    {"id": "kc_sports_005", "name": "跳绳冠军", "faction": "key_class", "type": "unit", "subtype": "sports", "cost": 2, "attack": 3, "defense": 1, "hp": 2, "ability": "攻击时：对目标相邻单位造成1点伤害", "rarity": "uncommon", "flavor": "绳子快到看不见了"},
    
    # -- discipline units --
    {"id": "kc_discipline_003", "name": "校风纠察队", "faction": "key_class", "type": "unit", "subtype": "discipline", "cost": 3, "attack": 2, "defense": 3, "hp": 3, "ability": "回合开始时：对敌方HQ造成1点伤害", "rarity": "common", "flavor": "「校牌戴好，头发剪短」"},
    {"id": "kc_discipline_004", "name": "早读督查", "faction": "key_class", "type": "unit", "subtype": "discipline", "cost": 2, "attack": 2, "defense": 2, "hp": 2, "ability": "沉默一个攻击力≤3的敌方单位", "rarity": "rare", "flavor": "「大声点，我听不见！」"},
    {"id": "kc_discipline_005", "name": "纪律标兵", "faction": "key_class", "type": "unit", "subtype": "discipline", "cost": 4, "attack": 4, "defense": 2, "hp": 4, "ability": "出场时：抽1张牌。每回合第一次打出牌时费用-1", "rarity": "epic", "flavor": "上课从不说话——因为他在睡觉"},
    
    # -- scholar units --
    {"id": "kc_scholar_004", "name": "奥数金牌得主", "faction": "key_class", "type": "unit", "subtype": "scholar", "cost": 5, "attack": 4, "defense": 2, "hp": 6, "ability": "「先攻」。主动：抽1张牌（冷却 3）", "rarity": "legendary", "flavor": "IMO金牌？不过是敲门砖"},
    {"id": "kc_scholar_005", "name": "古文默写机", "faction": "key_class", "type": "unit", "subtype": "scholar", "cost": 2, "attack": 2, "defense": 2, "hp": 2, "ability": "亡语：给手牌中费用最高的牌费用-1", "rarity": "uncommon", "flavor": "「《出师表》——预备，起！」"},
    {"id": "kc_scholar_006", "name": "化学课代表", "faction": "key_class", "type": "unit", "subtype": "scholar", "cost": 3, "attack": 3, "defense": 1, "hp": 4, "ability": "出场时：对敌方所有单位造成1点伤害", "rarity": "uncommon", "flavor": "把实验室的氨水味带到了教室"},
    
    # -- broadcast units --
    {"id": "kc_broadcast_003", "name": "课间操广播", "faction": "key_class", "type": "unit", "subtype": "broadcast", "cost": 6, "attack": 5, "defense": 3, "hp": 5, "ability": "主动：对所有敌方单位造成3点伤害（冷却 3）", "rarity": "legendary", "flavor": "「第八套广播体操——现在开始！」"},
    {"id": "kc_broadcast_004", "name": "听力播音员", "faction": "key_class", "type": "unit", "subtype": "broadcast", "cost": 4, "attack": 3, "defense": 1, "hp": 4, "ability": "「空军」。回合结束时：所有敌方单位-1攻击（本回合）", "rarity": "rare", "flavor": "「听力部分现在开始，试音……」"},
    
    # -- command/event cards --
    {"id": "kc_cmd_003", "name": "模拟考试", "faction": "key_class", "type": "command", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "抽2张牌，弃1张牌", "rarity": "common", "flavor": "考试——唯一一个分数越高越开心的折磨"},
    {"id": "kc_cmd_004", "name": "重点班选拔", "faction": "key_class", "type": "command", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "抽1张牌。若手牌中刚好有3张牌，再抽1张", "rarity": "uncommon", "flavor": "只有前50名才能进的班级"},
    {"id": "kc_command_009", "name": "校长讲话", "faction": "key_class", "type": "command", "subtype": None, "cost": 5, "attack": 0, "defense": 0, "hp": 0, "ability": "使所有友方单位永久+1/+0/+1，抽1张牌", "rarity": "epic", "flavor": "「我再讲两句话」——两小时过去了"},
    {"id": "kc_command_010", "name": "家长会通知", "faction": "key_class", "type": "command", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "摧毁一个费用≤3的敌方单位。若手牌≤2张，改为摧毁一个费用≤5的敌方单位", "rarity": "rare", "flavor": "「请家长务必准时参加」——然后全班都留下了心理阴影"},
    
    # -- counter/snitch cards --
    {"id": "kc_counter_003", "name": "突击测验", "faction": "key_class", "type": "counter", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手抽牌时触发：使其弃1张牌", "rarity": "uncommon", "flavor": "「明天突击测验」——比恐怖片还吓人"},
    {"id": "kc_counter_004", "name": "翻书检查", "faction": "key_class", "type": "counter", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手打出单位时触发：沉默该单位并抽1张牌", "rarity": "rare", "flavor": "「把书拿出来，我看看你笔记记了多少」"},
    
    # -- buff/event cards --
    {"id": "kc_buff_008", "name": "全科辅导", "faction": "key_class", "type": "buff", "subtype": None, "cost": 4, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得+1/+2/+2和「先攻」", "rarity": "uncommon", "flavor": "语文数学英语物理化学生物——各科老师轮流补课"},
    {"id": "kc_buff_009", "name": "周末补习班", "faction": "key_class", "type": "buff", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位永久+2/+0/+1", "rarity": "common", "flavor": "周末？不存在的"},
    
    # -- generic unit cards --
    {"id": "kc_unit_030", "name": "值日班长", "faction": "key_class", "type": "unit", "subtype": "discipline", "cost": 3, "attack": 3, "defense": 2, "hp": 3, "ability": "出场时：将一个1/2/2「值日牌」衍生物置入支持线", "rarity": "common", "flavor": "「今天的值日生是哪一组？」"},
    {"id": "kc_unit_031", "name": "考试倒计时牌", "faction": "key_class", "type": "unit", "subtype": "broadcast", "cost": 2, "attack": 1, "defense": 1, "hp": 1, "ability": "主动：减少敌方所有单位1点生命（冷却 1）", "rarity": "uncommon", "flavor": "「距离高考还有XX天」——每天都在减少"},
    {"id": "kc_unit_032", "name": "重点班插班生", "faction": "key_class", "type": "unit", "subtype": "student", "cost": 6, "attack": 6, "defense": 3, "hp": 6, "ability": "「穿透」。出场时：若手牌≤3张，对所有敌方单位造成2点伤害", "rarity": "epic", "flavor": "从普通班杀上来的狠人"},
    
    # ═══════════════════════════════════════════
    # normal_class (普通班) — 35 new cards
    # Identity: swarm, tokens, deathrattle, synergy
    # ═══════════════════════════════════════════
    
    {"id": "nc_student_006", "name": "后排聊天专业户", "faction": "normal_class", "type": "unit", "subtype": "student", "cost": 2, "attack": 1, "defense": 1, "hp": 4, "ability": "回合结束时：召唤一个1/1/1「快闪兵」", "rarity": "common", "flavor": "最后一排永远是信息交流中心"},
    {"id": "nc_student_007", "name": "转校生", "faction": "normal_class", "type": "unit", "subtype": "student", "cost": 1, "attack": 2, "defense": 1, "hp": 2, "ability": "入场时：本回合获得+1攻击", "rarity": "common", "flavor": "「大家好，我叫……（声音越来越小）」"},
    {"id": "nc_student_008", "name": "班长大人", "faction": "normal_class", "type": "unit", "subtype": "student", "cost": 5, "attack": 4, "defense": 3, "hp": 4, "ability": "主动：使所有普通班友方单位获得+1/+0/+1（冷却 2）", "rarity": "epic", "flavor": "「别吵了！老师来了！」"},
    
    # -- sports --
    {"id": "nc_sports_004", "name": "体育课代表", "faction": "normal_class", "type": "unit", "subtype": "sports", "cost": 3, "attack": 3, "defense": 2, "hp": 3, "ability": "「冲锋」。亡语：召唤一个2/1/2「体育委员」", "rarity": "uncommon", "flavor": "「体育老师生病了」——体育课代表表示不服"},
    {"id": "nc_sports_005", "name": "拔河队员", "faction": "normal_class", "type": "unit", "subtype": "sports", "cost": 2, "attack": 2, "defense": 2, "hp": 3, "ability": "相邻友方单位+1攻击", "rarity": "common", "flavor": "一二三，拉！"},
    {"id": "nc_sports_006", "name": "校足球队前锋", "faction": "normal_class", "type": "unit", "subtype": "sports", "cost": 4, "attack": 5, "defense": 1, "hp": 4, "ability": "主动：对敌方HQ造成2点伤害（冷却 2）", "rarity": "rare", "flavor": "球进了！——然后发现踢的是教室玻璃"},
    
    # -- discipline --
    {"id": "nc_discipline_003", "name": "课堂纪律委员", "faction": "normal_class", "type": "unit", "subtype": "discipline", "cost": 1, "attack": 1, "defense": 1, "hp": 2, "ability": "亡语：抽1张牌", "rarity": "common", "flavor": "「谁再说话就记名字了！」——然后自己也被记了"},
    {"id": "nc_discipline_004", "name": "考勤记录员", "faction": "normal_class", "type": "unit", "subtype": "discipline", "cost": 2, "attack": 2, "defense": 1, "hp": 3, "ability": "出场时：你的下一个单位费用-1", "rarity": "uncommon", "flavor": "「迟到一次扣操行分0.5」"},
    
    # -- scholar --
    {"id": "nc_scholar_003", "name": "复读机学霸", "faction": "normal_class", "type": "unit", "subtype": "scholar", "cost": 4, "attack": 4, "defense": 2, "hp": 4, "ability": "你每有一个其他普通班单位，此牌费用-1（最低1）", "rarity": "rare", "flavor": "「这道题老师讲过多少遍了？」"},
    
    # -- broadcast --
    {"id": "nc_broadcast_002", "name": "校园广播员", "faction": "normal_class", "type": "unit", "subtype": "broadcast", "cost": 3, "attack": 3, "defense": 1, "hp": 3, "ability": "主动：所有友方普通班单位获得+1/+0/+0（冷却 2）", "rarity": "rare", "flavor": "「通知：放学后全体留下大扫除」"},
    
    # -- command --
    {"id": "nc_cmd_004", "name": "课间十分钟", "faction": "normal_class", "type": "command", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "本回合中，你的下一个单位费用-1", "rarity": "common", "flavor": "从教室到小卖部的往返跑"},
    {"id": "nc_command_009", "name": "班费集资", "faction": "normal_class", "type": "command", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "召唤3个1/1/1「课间快闪兵」", "rarity": "uncommon", "flavor": "「每人交五块钱，我们买足球」"},
    {"id": "nc_command_010", "name": "全校大扫除", "faction": "normal_class", "type": "command", "subtype": None, "cost": 5, "attack": 0, "defense": 0, "hp": 0, "ability": "使所有友方单位永久获得+1/+0/+1，召唤1个1/1/1「快闪兵」", "rarity": "epic", "flavor": "「你，擦窗户。你，拖地。你——别跑！」"},
    
    # -- counter --
    {"id": "nc_counter_004", "name": "课堂抽问", "faction": "normal_class", "type": "counter", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手攻击时触发：使正在攻击的单位返回手牌", "rarity": "rare", "flavor": "「小明，你来回答这道题」——全班瞬间低头"},
    
    # -- buff --
    {"id": "nc_buff_006", "name": "课代表辅导", "faction": "normal_class", "type": "buff", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得「亡语：召唤两个1/1/1「快闪兵」」", "rarity": "uncommon", "flavor": "「这题我教你，很简单的……」"},
    {"id": "nc_buff_007", "name": "班级公约", "faction": "normal_class", "type": "buff", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方普通班单位永久+1/+1/+1", "rarity": "common", "flavor": "「第一条：上课不许睡觉」"},
    
    # -- generic unit --
    {"id": "nc_unit_032", "name": "课间小卖部跑腿", "faction": "normal_class", "type": "unit", "subtype": "sports", "cost": 1, "attack": 2, "defense": 1, "hp": 1, "ability": "出场时：抽1张牌", "rarity": "common", "flavor": "「帮我带瓶水！」——然后课间十分钟变成了三分钟"},
    {"id": "nc_unit_033", "name": "后排递纸条高手", "faction": "normal_class", "type": "unit", "subtype": "student", "cost": 3, "attack": 2, "defense": 1, "hp": 2, "ability": "主动：将一个1/1/1「快闪兵」置入战场（冷却 1）", "rarity": "uncommon", "flavor": "从最后一排传到第一排只用了三秒"},
    {"id": "nc_unit_034", "name": "班主任", "faction": "normal_class", "type": "unit", "subtype": "discipline", "cost": 7, "attack": 6, "defense": 4, "hp": 7, "ability": "「威慑」。你的所有普通班单位费用-1", "rarity": "legendary", "flavor": "后门窗户上那张脸——每个学生的噩梦"},
    {"id": "nc_unit_035", "name": "升旗手", "faction": "normal_class", "type": "unit", "subtype": "broadcast", "cost": 4, "attack": 4, "defense": 2, "hp": 5, "ability": "「免疫」（从出场开始持续1回合）", "rarity": "uncommon", "flavor": "每周一，国旗下的讲话"},
    
    # ═══════════════════════════════════════════
    # competition_class (竞赛班) — 33 new cards
    # Identity: elite units, keywords, quality over quantity
    # ═══════════════════════════════════════════
    
    {"id": "cc_student_005", "name": "信息竞赛选手", "faction": "competition_class", "type": "unit", "subtype": "student", "cost": 2, "attack": 3, "defense": 1, "hp": 2, "ability": "「先攻」", "rarity": "common", "flavor": "他写的代码比作文还长"},
    {"id": "cc_student_006", "name": "物理竞赛大神", "faction": "competition_class", "type": "unit", "subtype": "student", "cost": 4, "attack": 5, "defense": 1, "hp": 4, "ability": "「穿透」", "rarity": "uncommon", "flavor": "「力的作用是相互的，考试成绩也是」"},
    {"id": "cc_student_007", "name": "数学竞赛国一", "faction": "competition_class", "type": "unit", "subtype": "student", "cost": 6, "attack": 6, "defense": 3, "hp": 6, "ability": "「免疫」（被攻击时）。主动：消灭一个受伤的敌方单位（冷却 1）", "rarity": "legendary", "flavor": "国家一等奖——不是每个省都有的"},
    
    {"id": "cc_sports_002", "name": "体竞双修", "faction": "competition_class", "type": "unit", "subtype": "sports", "cost": 3, "attack": 4, "defense": 1, "hp": 3, "ability": "「冲锋」。若你场上只有此单位，获得+1/+0/+0", "rarity": "uncommon", "flavor": "脑子好使，体能更好"},
    {"id": "cc_sports_003", "name": "特长生保送", "faction": "competition_class", "type": "unit", "subtype": "sports", "cost": 5, "attack": 5, "defense": 2, "hp": 5, "ability": "主动：本回合获得「穿透」和「先攻」（冷却 2）", "rarity": "rare", "flavor": "二级运动员，一本线65%"},
    
    {"id": "cc_discipline_003", "name": "竞赛班纪律", "faction": "competition_class", "type": "unit", "subtype": "discipline", "cost": 3, "attack": 3, "defense": 2, "hp": 3, "ability": "「威慑」", "rarity": "common", "flavor": "迟到一次——取消竞赛资格"},
    {"id": "cc_discipline_004", "name": "实验室管理员", "faction": "competition_class", "type": "unit", "subtype": "discipline", "cost": 4, "attack": 4, "defense": 3, "hp": 3, "ability": "出场时：获得一个敌方单位的控制权（至回合结束）", "rarity": "epic", "flavor": "「仪器用完记得归位」"},
    
    {"id": "cc_scholar_004", "name": "化竞选手", "faction": "competition_class", "type": "unit", "subtype": "scholar", "cost": 1, "attack": 2, "defense": 1, "hp": 2, "ability": "亡语：对一个敌方单位造成2点伤害", "rarity": "common", "flavor": "试管里的颜色比彩虹还丰富"},
    {"id": "cc_scholar_005", "name": "生物竞赛冠军", "faction": "competition_class", "type": "unit", "subtype": "scholar", "cost": 3, "attack": 2, "defense": 2, "hp": 5, "ability": "回合结束时：恢复所有友方单位1点生命", "rarity": "uncommon", "flavor": "细胞分裂的速度都没有他翻书快"},
    
    {"id": "cc_broadcast_002", "name": "竞赛通知播报", "faction": "competition_class", "type": "unit", "subtype": "broadcast", "cost": 2, "attack": 1, "defense": 1, "hp": 3, "ability": "出场时：抽1张牌。如果是竞赛班单位，费用-1", "rarity": "rare", "flavor": "「第39届物理竞赛报名开始了」"},
    
    {"id": "cc_cmd_004", "name": "集训队选拔", "faction": "competition_class", "type": "command", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "检视牌库顶3张牌，选择1张入手，其余放回", "rarity": "uncommon", "flavor": "百里挑一，残酷而真实"},
    {"id": "cc_command_008", "name": "省队集训", "faction": "competition_class", "type": "command", "subtype": None, "cost": 5, "attack": 0, "defense": 0, "hp": 0, "ability": "抽3张牌。本回合你打出的下一张竞赛班单位费用-2", "rarity": "epic", "flavor": "封闭式训练，与世隔绝"},
    
    {"id": "cc_counter_003", "name": "竞赛失利复盘", "faction": "competition_class", "type": "counter", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "当你的单位被摧毁时触发：抽1张牌", "rarity": "common", "flavor": "「没关系，明年再来」"},
    {"id": "cc_counter_004", "name": "压轴题", "faction": "competition_class", "type": "counter", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手打出费用≥5的单位时触发：将其返回手牌", "rarity": "rare", "flavor": "最后一道大题——99%的人做不出来"},
    
    {"id": "cc_buff_007", "name": "赛前冲刺", "faction": "competition_class", "type": "buff", "subtype": None, "cost": 4, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得+2/+0/+2和「冲锋」", "rarity": "uncommon", "flavor": "临阵磨枪，不快也光"},
    {"id": "cc_buff_008", "name": "金牌教练指导", "faction": "competition_class", "type": "buff", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个竞赛班单位永久获得「先攻」和「穿透」", "rarity": "rare", "flavor": "「这道题用母函数做，很简单的」"},
    
    {"id": "cc_unit_029", "name": "竞赛班插班考第一", "faction": "competition_class", "type": "unit", "subtype": "scholar", "cost": 7, "attack": 7, "defense": 3, "hp": 7, "ability": "「穿透」。场上每有其他竞赛班单位，此牌费用-1", "rarity": "legendary", "flavor": "他来的那天，所有人都知道第一名要换了"},
    {"id": "cc_unit_030", "name": "实验器材守护者", "faction": "competition_class", "type": "unit", "subtype": "discipline", "cost": 2, "attack": 1, "defense": 2, "hp": 3, "ability": "回合结束时：获得+1/+0/+0", "rarity": "common", "flavor": "显微镜比他的命还贵"},
    {"id": "cc_unit_031", "name": "天文学竞赛选手", "faction": "competition_class", "type": "unit", "subtype": "scholar", "cost": 4, "attack": 3, "defense": 1, "hp": 5, "ability": "「空军」。主动：对敌方所有空中单位造成3点伤害（冷却 2）", "rarity": "rare", "flavor": "望远镜里看到的不是星星，是未来的录取通知书"},
    
    # ═══════════════════════════════════════════
    # intl_class (国际班) — 33 new cards
    # Identity: resource advantage, flexibility, versatile
    # ═══════════════════════════════════════════
    
    {"id": "ic_student_005", "name": "交换生", "faction": "intl_class", "type": "unit", "subtype": "student", "cost": 2, "attack": 2, "defense": 2, "hp": 3, "ability": "出场时：获得1点临时费用（本回合可用）", "rarity": "common", "flavor": "「我们学校在美国有个姐妹校」"},
    {"id": "ic_student_006", "name": "国际部学生会", "faction": "intl_class", "type": "unit", "subtype": "student", "cost": 4, "attack": 3, "defense": 3, "hp": 4, "ability": "主动：抽1张牌。若手牌≥5张，再抽1张（冷却 2）", "rarity": "epic", "flavor": "学生会的活动经费比班费多一百倍"},
    {"id": "ic_student_007", "name": "托福满分王", "faction": "intl_class", "type": "unit", "subtype": "student", "cost": 3, "attack": 3, "defense": 2, "hp": 3, "ability": "你每有一张手牌，此牌获得+1攻击", "rarity": "rare", "flavor": "120分——不是总分，是单项"},
    
    {"id": "ic_sports_003", "name": "高尔夫球手", "faction": "intl_class", "type": "unit", "subtype": "sports", "cost": 1, "attack": 1, "defense": 1, "hp": 2, "ability": "主动：对敌方单位造成1点伤害（冷却 1）", "rarity": "uncommon", "flavor": "一杆进洞——然后发现打的是校长室玻璃"},
    {"id": "ic_sports_004", "name": "马术队员", "faction": "intl_class", "type": "unit", "subtype": "sports", "cost": 5, "attack": 5, "defense": 3, "hp": 4, "ability": "「冲锋」。你每有一张手牌，此牌获得+1/+0/+0", "rarity": "rare", "flavor": "骑马比走路还贵的运动"},
    
    {"id": "ic_discipline_002", "name": "模联主席团", "faction": "intl_class", "type": "unit", "subtype": "discipline", "cost": 4, "attack": 4, "defense": 2, "hp": 5, "ability": "回合开始时：若手牌≥4张，对敌方HQ造成1点伤害", "rarity": "uncommon", "flavor": "「尊敬的各位代表，现在开始投票」"},
    {"id": "ic_discipline_003", "name": "国际学校风纪", "faction": "intl_class", "type": "unit", "subtype": "discipline", "cost": 3, "attack": 3, "defense": 2, "hp": 3, "ability": "入场时：回复2点HQ生命", "rarity": "common", "flavor": "「Dress code! No slippers!」"},
    
    {"id": "ic_scholar_004", "name": "AP全五分", "faction": "intl_class", "type": "unit", "subtype": "scholar", "cost": 5, "attack": 5, "defense": 2, "hp": 5, "ability": "主动：回复3点HQ生命，抽1张牌（冷却 3）", "rarity": "legendary", "flavor": "八门AP全部5分——这就是钞能力？不，是肝能力"},
    {"id": "ic_scholar_005", "name": "SAT满分", "faction": "intl_class", "type": "unit", "subtype": "scholar", "cost": 7, "attack": 7, "defense": 3, "hp": 7, "ability": "「先攻」。你每有一张手牌，此牌费用-1", "rarity": "legendary", "flavor": "1600分——完美的答卷"},
    
    {"id": "ic_broadcast_002", "name": "校园电视台", "faction": "intl_class", "type": "unit", "subtype": "broadcast", "cost": 3, "attack": 2, "defense": 1, "hp": 4, "ability": "回合结束时：抽1张牌。若手牌≥4张，再抽1张", "rarity": "uncommon", "flavor": "「欢迎收看校园新闻联播」"},
    
    {"id": "ic_cmd_004", "name": "海外研学", "faction": "intl_class", "type": "command", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "抽2张牌。若手牌≥5张，额外获得1点临时费用", "rarity": "uncommon", "flavor": "「去剑桥两周，费用自理」"},
    {"id": "ic_command_011", "name": "留学申请文书", "faction": "intl_class", "type": "command", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "检视你的牌库并选择一张牌入手，洗牌", "rarity": "epic", "flavor": "「Describe a challenge you have overcome」——贫穷"},
    
    {"id": "ic_counter_005", "name": "DELE考试", "faction": "intl_class", "type": "counter", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手打出单位时触发：若手牌≥4张，沉默该单位", "rarity": "uncommon", "flavor": "西班牙语等级考试——比英语难十倍"},
    {"id": "ic_counter_006", "name": "签证面试", "faction": "intl_class", "type": "counter", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手使用能力或法术时触发：使其无效并抽1张牌", "rarity": "rare", "flavor": "「Why do you want to go to the US?」——「To study」"},
    
    {"id": "ic_buff_006", "name": "IB课程辅导", "faction": "intl_class", "type": "buff", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得+1/+1/+2", "rarity": "common", "flavor": "International Baccalaureate——国际化的卷"},
    {"id": "ic_buff_007", "name": "推荐信", "faction": "intl_class", "type": "buff", "subtype": None, "cost": 4, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得+3/+0/+3和「先攻」", "rarity": "rare", "flavor": "「该生表现优异，特此推荐」——校长签名"},
    
    {"id": "ic_unit_025", "name": "国际部新生", "faction": "intl_class", "type": "unit", "subtype": "student", "cost": 1, "attack": 1, "defense": 1, "hp": 2, "ability": "出场时：回复1点HQ生命", "rarity": "common", "flavor": "第一天来学校就穿了一身Armani"},
    {"id": "ic_unit_026", "name": "外教", "faction": "intl_class", "type": "unit", "subtype": "scholar", "cost": 5, "attack": 4, "defense": 2, "hp": 6, "ability": "回合结束时：给一个随机友方单位+1/+0/+1", "rarity": "uncommon", "flavor": "「Good morning class, today we will discuss...」"},
    {"id": "ic_unit_027", "name": "多语种翻译", "faction": "intl_class", "type": "unit", "subtype": "broadcast", "cost": 2, "attack": 2, "defense": 1, "hp": 2, "ability": "主动：交换一个友方单位和敌方单位的位置（冷却 2）", "rarity": "rare", "flavor": "中文英文法文德文西班牙文——无缝切换"},
    
    # ═══════════════════════════════════════════
    # arts_class (艺体班) — 33 new cards
    # Identity: command synergy, ranged, control
    # ═══════════════════════════════════════════
    
    {"id": "ac_student_005", "name": "美术生", "faction": "arts_class", "type": "unit", "subtype": "student", "cost": 2, "attack": 2, "defense": 2, "hp": 2, "ability": "「远程」。回合结束时：对手弃1张牌", "rarity": "common", "flavor": "画的速写比数学作业还厚"},
    {"id": "ac_student_006", "name": "舞蹈生", "faction": "arts_class", "type": "unit", "subtype": "student", "cost": 3, "attack": 4, "defense": 1, "hp": 3, "ability": "「闪避」。主动：本回合获得「免疫」（冷却 2）", "rarity": "rare", "flavor": "下腰的时候敌人根本打不到"},
    {"id": "ac_student_007", "name": "播音主持", "faction": "arts_class", "type": "unit", "subtype": "student", "cost": 1, "attack": 1, "defense": 1, "hp": 2, "ability": "出场时：本回合使用的下一张命令卡费用-1", "rarity": "uncommon", "flavor": "「各位观众朋友们大家晚上好」"},
    
    {"id": "ac_sports_004", "name": "啦啦队长", "faction": "arts_class", "type": "unit", "subtype": "sports", "cost": 3, "attack": 2, "defense": 2, "hp": 4, "ability": "回合开始时：所有友方单位+1攻击（本回合）", "rarity": "common", "flavor": "加油！加油！——嗓子都喊哑了"},
    {"id": "ac_sports_005", "name": "艺术体操队员", "faction": "arts_class", "type": "unit", "subtype": "sports", "cost": 2, "attack": 3, "defense": 1, "hp": 2, "ability": "「闪避」", "rarity": "uncommon", "flavor": "彩带飞舞的瞬间，像极了青春"},
    {"id": "ac_sports_006", "name": "田径队短跑王", "faction": "arts_class", "type": "unit", "subtype": "sports", "cost": 5, "attack": 6, "defense": 2, "hp": 4, "ability": "「冲锋」。主动：本回合获得+2/+0/+0（冷却 1）", "rarity": "rare", "flavor": "100米9秒8——校运会记录保持者"},
    
    {"id": "ac_discipline_003", "name": "形体课老师", "faction": "arts_class", "type": "unit", "subtype": "discipline", "cost": 4, "attack": 3, "defense": 2, "hp": 5, "ability": "「威慑」。回合结束时：给一个友方单位+1/+0/+0", "rarity": "uncommon", "flavor": "「挺胸！收腹！——再来一组」"},
    
    {"id": "ac_scholar_003", "name": "艺术史研究", "faction": "arts_class", "type": "unit", "subtype": "scholar", "cost": 3, "attack": 2, "defense": 2, "hp": 4, "ability": "出场时：抽1张命令卡", "rarity": "common", "flavor": "从文艺复兴到当代艺术——一本通"},
    {"id": "ac_scholar_004", "name": "乐理满分", "faction": "arts_class", "type": "unit", "subtype": "scholar", "cost": 5, "attack": 4, "defense": 2, "hp": 6, "ability": "你的命令卡费用-1。主动：抽1张命令卡（冷却 2）", "rarity": "legendary", "flavor": "和声、曲式、配器——没有他不会的"},
    
    {"id": "ac_broadcast_002", "name": "校园乐队主唱", "faction": "arts_class", "type": "unit", "subtype": "broadcast", "cost": 4, "attack": 4, "defense": 1, "hp": 4, "ability": "主动：对一个敌方单位造成2点伤害，回复你的HQ2点生命（冷却 2）", "rarity": "rare", "flavor": "「明天会更好」——然后被宿管阿姨叫停了"},
    
    {"id": "ac_cmd_004", "name": "艺术节报名", "faction": "arts_class", "type": "command", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "抽1张命令卡，其费用-1", "rarity": "common", "flavor": "「艺术节报名截止到本周五」"},
    {"id": "ac_command_010", "name": "文化节汇演", "faction": "arts_class", "type": "command", "subtype": None, "cost": 4, "attack": 0, "defense": 0, "hp": 0, "ability": "对所有敌方单位造成2点伤害。每有一个友方艺体班单位，伤害+1", "rarity": "epic", "flavor": "唱歌跳舞话剧相声——精彩纷呈"},
    
    {"id": "ac_counter_005", "name": "走音警告", "faction": "arts_class", "type": "counter", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手打出单位时触发：使其获得-2攻击（永久）", "rarity": "uncommon", "flavor": "「你跑调了」——来自音乐老师的暴击"},
    {"id": "ac_counter_006", "name": "颜料泼墨", "faction": "arts_class", "type": "counter", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手攻击时触发：使攻击单位返回手牌，费用+1", "rarity": "rare", "flavor": "一幅泼墨山水画——和对手的战术一起毁了"},
    
    {"id": "ac_buff_005", "name": "演出服租赁", "faction": "arts_class", "type": "buff", "subtype": None, "cost": 1, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得+1/+0/+1", "rarity": "common", "flavor": "租一次演出服比买还贵"},
    {"id": "ac_buff_006", "name": "专业调音", "faction": "arts_class", "type": "buff", "subtype": None, "cost": 3, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得「远程」和+1/+0/+1", "rarity": "uncommon", "flavor": "调音师的耳朵比狗还灵"},
    
    {"id": "ac_unit_026", "name": "话剧组主演", "faction": "arts_class", "type": "unit", "subtype": "broadcast", "cost": 6, "attack": 5, "defense": 3, "hp": 5, "ability": "「闪避」。主动：操控一个费用≤4的敌方单位（冷却 3）", "rarity": "legendary", "flavor": "「人生如戏，全凭演技」——然后他真的演上了"},
    {"id": "ac_unit_027", "name": "画室模特", "faction": "arts_class", "type": "unit", "subtype": "student", "cost": 1, "attack": 1, "defense": 1, "hp": 3, "ability": "「免疫」（出场回合）", "rarity": "common", "flavor": "坐着一动不动三个小时——比上课还累"},
    {"id": "ac_unit_028", "name": "合唱团指挥", "faction": "arts_class", "type": "unit", "subtype": "broadcast", "cost": 5, "attack": 3, "defense": 3, "hp": 5, "ability": "你的命令卡费用-1。出场时：抽1张命令卡", "rarity": "epic", "flavor": "双手一挥，百人齐唱——那气势"},
    
    # ═══════════════════════════════════════════
    # neutral (中立) — 30 new cards
    # Identity: generic support, utility, filling gaps
    # ═══════════════════════════════════════════
    
    {"id": "ne_student_003", "name": "转学来的新生", "faction": "neutral", "type": "unit", "subtype": "student", "cost": 2, "attack": 2, "defense": 1, "hp": 3, "ability": "出场时：获得你主势力的阵营被动一个回合", "rarity": "uncommon", "flavor": "「我以前的学校……比这里好多了」"},
    {"id": "ne_student_004", "name": "年级第一", "faction": "neutral", "type": "unit", "subtype": "student", "cost": 8, "attack": 8, "defense": 4, "hp": 8, "ability": "「免疫」（从出场开始持续1回合）。无法被沉默", "rarity": "legendary", "flavor": "全年级第一的名字永远在公告栏最上面"},
    
    {"id": "ne_sports_001", "name": "运动会志愿者", "faction": "neutral", "type": "unit", "subtype": "sports", "cost": 1, "attack": 1, "defense": 1, "hp": 2, "ability": "出场时：回复1点HQ生命", "rarity": "common", "flavor": "「同学，检录处在那边」"},
    {"id": "ne_sports_002", "name": "校纪录保持者", "faction": "neutral", "type": "unit", "subtype": "sports", "cost": 5, "attack": 5, "defense": 3, "hp": 5, "ability": "主动：本回合获得「冲锋」和+2/+0/+0（冷却 3）", "rarity": "epic", "flavor": "纪录是用来被打破的——但那个人不是你"},
    
    {"id": "ne_scholar_003", "name": "图书管理员", "faction": "neutral", "type": "unit", "subtype": "scholar", "cost": 3, "attack": 2, "defense": 2, "hp": 4, "ability": "入场时：从牌库抽一张牌，如果是单位牌则费用-1", "rarity": "uncommon", "flavor": "「嘘——图书馆不许说话」"},
    {"id": "ne_scholar_004", "name": "借书超时不还者", "faction": "neutral", "type": "unit", "subtype": "scholar", "cost": 2, "attack": 3, "defense": 1, "hp": 2, "ability": "「先攻」", "rarity": "common", "flavor": "那本书已经借了三年了"},
    
    {"id": "ne_discipline_001", "name": "门卫大爷", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 2, "attack": 1, "defense": 3, "hp": 3, "ability": "「威慑」。敌方单位进入战场时有50%概率被沉默（本回合）", "rarity": "rare", "flavor": "「哪个班的？——学生证呢？」"},
    {"id": "ne_discipline_002", "name": "宿管阿姨", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 4, "attack": 3, "defense": 3, "hp": 4, "ability": "回合开始时：沉默一个攻击力最高的敌方单位至回合结束", "rarity": "rare", "flavor": "「几点了还不睡觉！」——十点整"},
    
    {"id": "ne_broadcast_003", "name": "团委通知栏", "faction": "neutral", "type": "unit", "subtype": "broadcast", "cost": 3, "attack": 2, "defense": 2, "hp": 4, "ability": "回合结束时：抽1张牌", "rarity": "common", "flavor": "「通知：明天下午第二节课后开班会」"},
    {"id": "ne_broadcast_004", "name": "优秀学生展板", "faction": "neutral", "type": "unit", "subtype": "broadcast", "cost": 4, "attack": 3, "defense": 2, "hp": 5, "ability": "你每打出一个单位，抽1张牌（每回合最多1次）", "rarity": "rare", "flavor": "照片贴在公告栏里一年了还没换"},
    
    {"id": "ne_cmd_003", "name": "校运动会", "faction": "neutral", "type": "command", "subtype": None, "cost": 4, "attack": 0, "defense": 0, "hp": 0, "ability": "使所有友方单位获得+1/+0/+0和「冲锋」本回合", "rarity": "uncommon", "flavor": "一年一度的集体狂欢"},
    {"id": "ne_command_007", "name": "开学典礼", "faction": "neutral", "type": "command", "subtype": None, "cost": 6, "attack": 0, "defense": 0, "hp": 0, "ability": "召唤4个1/1/1「新生」衍生物", "rarity": "rare", "flavor": "「同学们，新的学期开始了」——然后讲了两小时"},
    
    {"id": "ne_counter_004", "name": "校园广播通知", "faction": "neutral", "type": "counter", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手抽牌时触发：你也抽1张牌", "rarity": "uncommon", "flavor": "「通知：请以下同学到教务处……」"},
    {"id": "ne_counter_005", "name": "教导处传唤", "faction": "neutral", "type": "counter", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "当对手用能力或打出单位时触发：冻结该单位一回合", "rarity": "common", "flavor": "「你，跟我去一趟教导处」"},
    
    {"id": "ne_buff_004", "name": "国旗下的讲话", "faction": "neutral", "type": "buff", "subtype": None, "cost": 5, "attack": 0, "defense": 0, "hp": 0, "ability": "使所有友方单位永久获得+1/+1/+1", "rarity": "legendary", "flavor": "「今天我讲话的题目是：奋斗的青春最美丽」"},
    {"id": "ne_buff_005", "name": "社会实践", "faction": "neutral", "type": "buff", "subtype": None, "cost": 2, "attack": 0, "defense": 0, "hp": 0, "ability": "使一个友方单位获得+1/+1/+1", "rarity": "common", "flavor": "去敬老院扫地——然后写两千字感想"},
    
    {"id": "ne_unit_025", "name": "值周生", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 1, "attack": 2, "defense": 1, "hp": 1, "ability": "", "rarity": "common", "flavor": "红袖标一戴，谁都不爱"},
    {"id": "ne_unit_026", "name": "学生会主席", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 6, "attack": 5, "defense": 4, "hp": 5, "ability": "主动：使一个友方单位获得+2/+0/+2（冷却 2）", "rarity": "legendary", "flavor": "校长面前的红人，学生眼中的叛徒"},
    {"id": "ne_unit_027", "name": "食堂阿姨", "faction": "neutral", "type": "unit", "subtype": "sports", "cost": 3, "attack": 4, "defense": 2, "hp": 3, "ability": "「穿透」——她的手抖一下，你的肉就没了", "rarity": "uncommon", "flavor": "「同学，要什么菜？」——然后手抖了三下"},
    {"id": "ne_unit_028", "name": "医务室校医", "faction": "neutral", "type": "unit", "subtype": "scholar", "cost": 2, "attack": 1, "defense": 1, "hp": 3, "ability": "主动：回复一个友方单位2点生命（冷却 1）", "rarity": "common", "flavor": "「多喝热水」——校医的万能处方"},
    {"id": "ne_unit_029", "name": "心理辅导老师", "faction": "neutral", "type": "unit", "subtype": "scholar", "cost": 3, "attack": 1, "defense": 2, "hp": 4, "ability": "回合结束时：回复所有受伤友方单位1点生命", "rarity": "uncommon", "flavor": "「压力大是正常的，要学会调节」"},
    {"id": "ne_unit_030", "name": "保安队长", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 5, "attack": 4, "defense": 4, "hp": 5, "ability": "「威慑」。敌方单位攻击时，-1攻击（本回合）", "rarity": "rare", "flavor": "「外卖不能进校门」——铁面无私"},
    
    # ═══════════════════════════════════════════
    # More active-ability key_class cards (bonus)
    # ═══════════════════════════════════════════
    {"id": "kc_active_001", "name": "重点班班主任", "faction": "key_class", "type": "unit", "subtype": "discipline", "cost": 6, "attack": 4, "defense": 3, "hp": 6, "ability": "主动：使一个友方单位本回合可以攻击两次（冷却 3）", "rarity": "legendary", "flavor": "「你们是我带过最差的一届」——然后全班985"},
    {"id": "kc_active_002", "name": "高考倒计时牌", "faction": "key_class", "type": "unit", "subtype": "broadcast", "cost": 4, "attack": 2, "defense": 2, "hp": 3, "ability": "主动：减少所有敌方单位1点防御（冷却 1）", "rarity": "rare", "flavor": "每一天都在减少，焦虑每天都在增加"},
    
    # ═══════════════════════════════════════════
    # More neutral cards (fill to ~30)
    # ═══════════════════════════════════════════
    {"id": "ne_unit_031", "name": "计算机课代表", "faction": "neutral", "type": "unit", "subtype": "scholar", "cost": 4, "attack": 4, "defense": 1, "hp": 5, "ability": "主动：沉默一个敌方单位（冷却 2）", "rarity": "rare", "flavor": "「重启一下试试」"},
    {"id": "ne_unit_032", "name": "实验楼保洁", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 2, "attack": 2, "defense": 2, "hp": 2, "ability": "亡语：将一个1/1/1「实验器材」衍生物置入支持线", "rarity": "common", "flavor": "试管碎了就要写检讨"},
    {"id": "ne_unit_033", "name": "家长委员会代表", "faction": "neutral", "type": "unit", "subtype": "discipline", "cost": 5, "attack": 4, "defense": 3, "hp": 5, "ability": "出场时：抽2张牌", "rarity": "epic", "flavor": "「我建议……」「我反对……」「我提议……」"},
    {"id": "ne_unit_034", "name": "校友捐赠者", "faction": "neutral", "type": "unit", "subtype": "scholar", "cost": 7, "attack": 6, "defense": 4, "hp": 6, "ability": "主动：对所有敌方单位造成4点伤害（冷却 3）", "rarity": "legendary", "flavor": "「我捐一栋楼」——他真捐了"},
]

def main():
    with open(FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    existing_ids = {c["id"] for c in data["cards"]}
    added = 0
    skipped = 0

    for card in NEW_CARDS:
        if card["id"] in existing_ids:
            skipped += 1
            continue
        data["cards"].append(card)
        existing_ids.add(card["id"])
        added += 1

    with open(FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Added {added} new cards, skipped {skipped} duplicates")
    print(f"📊 Total cards now: {len(data['cards'])}")

if __name__ == "__main__":
    main()
