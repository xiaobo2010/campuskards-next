"""Pattern-based card effect execution for CampusKards v1."""
from __future__ import annotations

import logging
import random
import re
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

from .effect_choices import evaluate_condition, split_conditional_clauses
from .faction_synergy import (
    ARTS_CLASS,
    COMPETITION_CLASS,
    INTL_CLASS,
    KEY_CLASS,
    NORMAL_CLASS,
)

if TYPE_CHECKING:
    from .game_engine import CardInstance, GameState

# Re-export faction constants used in effect targeting
FACTION_ALIASES: dict[str, str] = {
    "普通班": NORMAL_CLASS,
    "竞赛班": COMPETITION_CLASS,
    "国际班": INTL_CLASS,
    "重点班": KEY_CLASS,
    "艺体班": ARTS_CLASS,
}


def _log(game: GameState, player: int, action: str, detail: str) -> None:
    game._log(player, action, detail)


def _draw_n(game: GameState, player: int, n: int) -> int:
    drawn = 0
    for _ in range(n):
        if game._draw_card(player):
            drawn += 1
    return drawn


def _all_enemy_units(game: GameState, player: int) -> list[CardInstance]:
    opp = game.battlefield.opponent_side(player)
    return opp.all_units[:]


def _all_friendly_units(game: GameState, player: int) -> list[CardInstance]:
    return game.battlefield.side_for(player).all_units[:]


def _damage_unit(
    unit: CardInstance,
    amount: int,
    *,
    attacker_power: int = 0,
    is_combat: bool = False,
) -> int:
    from .combat_rules import apply_combat_damage_to_unit

    return apply_combat_damage_to_unit(
        unit, amount, attacker_power=attacker_power, is_combat=is_combat
    )


def _kill_unit(game: GameState, player: int, unit: CardInstance) -> None:
    """Remove enemy unit and process death triggers."""
    opp = game.battlefield.opponent_side(player)
    opp.remove_unit(unit)
    opp.graveyard.append(unit)
    _trigger_deathrattle(game, 3 - player, unit)


def _kill_friendly(game: GameState, player: int, unit: CardInstance) -> None:
    side = game.battlefield.side_for(player)
    side.remove_unit(unit)
    side.graveyard.append(unit)
    _trigger_deathrattle(game, player, unit)


def _random_enemy_unit(game: GameState, player: int) -> CardInstance | None:
    units = _all_enemy_units(game, player)
    return random.choice(units) if units else None


def _find_target(
    game: GameState,
    player: int,
    target_uid: str | None,
    *,
    prefer_enemy: bool = True,
) -> CardInstance | None:
    if target_uid:
        pools = (
            [_all_enemy_units, _all_friendly_units]
            if prefer_enemy
            else [_all_friendly_units, _all_enemy_units]
        )
        for pool_fn in pools:
            for u in pool_fn(game, player):
                if u.uid == target_uid:
                    return u
    return None


def _parse_draw_count(text: str) -> int | None:
    m = re.search(r"抽\s*(\d+)\s*张", text)
    return int(m.group(1)) if m else None


def _parse_damage(text: str) -> int | None:
    for pat in (
        r"造成\s*(\d+)\s*点伤害",
        r"对.*?造成\s*(\d+)\s*点",
        r"(\d+)\s*点伤害",
    ):
        m = re.search(pat, text)
        if m:
            return int(m.group(1))
    return None


def _parse_stat_buff(text: str) -> tuple[int, int] | None:
    m = re.search(r"\+(\d+)/\+(\d+)", text)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"\+(\d+)\s*攻击", text)
    if m:
        return int(m.group(1)), 0
    m = re.search(r"\+(\d+)\s*防御", text)
    if m:
        return 0, int(m.group(1))
    return None


def _resolve_conditional_damage(
    game: GameState,
    player: int,
    text: str,
    *,
    base: int | None = None,
) -> int | None:
    """Pick damage amount, honoring 若…改为N点 clauses."""
    dmg = base if base is not None else _parse_damage(text)
    if dmg is None:
        return None
    _, conditionals = split_conditional_clauses(text)
    for cond, consequent in conditionals:
        if not evaluate_condition(game, player, cond):
            continue
        alt = _parse_damage(consequent)
        if alt is not None:
            return alt
        m = re.search(r"改为\s*(\d+)", consequent)
        if m:
            return int(m.group(1))
    return dmg


def _resolve_conditional_buff(
    game: GameState,
    player: int,
    text: str,
    *,
    default_pw: int,
    default_sp: int,
) -> tuple[int, int]:
    """Return (+power, +spirit/grit) for ally buffs with optional hand-size branch."""
    pw, sp = default_pw, default_sp
    _, conditionals = split_conditional_clauses(text)
    for cond, consequent in conditionals:
        if not evaluate_condition(game, player, cond):
            continue
        alt = _parse_stat_buff(consequent)
        if alt:
            pw, sp = alt
        m = re.search(r"改为\s*\+(\d+)/\+(\d+)", consequent)
        if m:
            pw, sp = int(m.group(1)), int(m.group(2))
    return pw, sp


def execute_effect_text(
    game: GameState,
    player: int,
    text: str,
    *,
    target_uid: str | None = None,
    source_unit: CardInstance | None = None,
    skip_choice: bool = False,
) -> None:
    """Resolve a single effect text block (choice branch or spell body)."""
    if not text:
        return
    if not skip_choice:
        from .effect_choices import parse_choice_branches

        if parse_choice_branches(text):
            return

    side = game.battlefield.side_for(player)

    # ── Draw effects ──
    draw_n = _parse_draw_count(text)
    if draw_n and "抽" in text and "搜索" not in text:
        extra = 0
        if "手牌" in text and "≥" in text:
            threshold_m = re.search(r"手牌\s*≥\s*(\d+)", text)
            if threshold_m and len(side.hand) >= int(threshold_m.group(1)):
                extra = 1
        total = draw_n + extra
        drawn = _draw_n(game, player, total)
        _log(game, player, "effect_draw", f"drew {drawn}")

    # ── Direct damage ──
    dmg = _resolve_conditional_damage(game, player, text)
    if dmg and "伤害" in text:
        target = None
        if target_uid:
            target = _find_target(game, player, target_uid)
        elif "随机" in text:
            target = _random_enemy_unit(game, player)
        elif "敌方" in text or "任意目标" in text:
            target = _random_enemy_unit(game, player)

        if target:
            actual = _damage_unit(target, dmg)
            _log(game, player, "effect_damage", f"{actual} dmg → {target.name}")
            if not target.alive:
                if target.owner == player:
                    _kill_friendly(game, player, target)
                else:
                    _kill_unit(game, player, target)
                    game._check_death(target.owner)

    # ── AOE damage to all enemies ──
    elif "所有敌方" in text and "伤害" in text:
        aoe = _resolve_conditional_damage(game, player, text) or 1
        for unit in _all_enemy_units(game, player)[:]:
            _damage_unit(unit, aoe)
            if not unit.alive:
                _kill_unit(game, player, unit)
        _log(game, player, "effect_aoe", f"{aoe} to all enemies")

    # ── Buff single unit (+2/+2 etc.) ──
    buff = _parse_stat_buff(text)
    if buff and (re.search(r"使.*?\+", text) or re.search(r"进入.*?\+", text)):
        pw, sp = _resolve_conditional_buff(game, player, text, default_pw=buff[0], default_sp=buff[1])
        pw, sp = _parse_stat_buff(text) or (pw, sp)
        target = _find_target(
            game,
            player,
            target_uid,
            prefer_enemy="敌方" in text,
        )
        if target:
            target.apply_temp_buff(power=pw, spirit=sp)
            _log(game, player, "effect_buff", f"+{pw}/+{sp} → {target.name}")

    # ── Buff all friendly units ──
    m = re.search(r"所有己方单位\s*\+(\d+)/\+(\d+)", text)
    if m:
        pw, sp = int(m.group(1)), int(m.group(2))
        pw, sp = _resolve_conditional_buff(game, player, text, default_pw=pw, default_sp=sp)
        for unit in _all_friendly_units(game, player):
            unit.apply_temp_buff(power=pw, spirit=sp)
        _log(game, player, "effect_buff", f"all allies +{pw}/+{sp}")

    # ── Buff all friendly units grit ──
    m = re.search(r"所有己方单位\s*\+(\d+)\s*防御", text)
    if m:
        bonus = int(m.group(1))
        for unit in _all_friendly_units(game, player):
            unit.apply_temp_buff(grit=bonus)
        _log(game, player, "effect_buff", f"+{bonus} grit all allies")

    # ── Mode switch (进攻/防御) ──
    if "进攻模式" in text or "防御模式" in text:
        target = _find_target(game, player, target_uid, prefer_enemy=False)
        if target:
            if "进攻模式" in text:
                target.apply_temp_buff(power=2)
            if "防御模式" in text:
                target.apply_temp_buff(grit=2)
            _log(game, player, "effect_mode", f"mode switch → {target.name}")

    # ── Buff ranged units power this turn ──
    m = re.search(r"「远程」单位本回合攻击力\+(\d+)", text)
    if m:
        bonus = int(m.group(1))
        for unit in _all_friendly_units(game, player):
            if unit.unit_type == "ranged" or "ranged" in unit.keywords:
                unit.apply_temp_buff(power=bonus)
        _log(game, player, "effect_buff", f"+{bonus} power to ranged")

    # ── Buff low-cost units ──
    m = re.search(r"费用≤(\d+)的单位\+(\d+)攻击", text)
    if m:
        max_cost, bonus = int(m.group(1)), int(m.group(2))
        for unit in _all_friendly_units(game, player):
            if unit.cost <= max_cost:
                unit.apply_temp_buff(power=bonus)

    # ── Buff faction unit ──
    for alias, code in FACTION_ALIASES.items():
        m = re.search(rf"使.*?{alias}.*?\+(\d+)/\+(\d+)", text)
        if m:
            pw, sp = int(m.group(1)), int(m.group(2))
            for unit in _all_friendly_units(game, player):
                if unit.faction == code:
                    unit.apply_temp_buff(power=pw, spirit=sp)
            break
        m2 = re.search(rf"所有{alias}单位本回合攻击力翻倍", text)
        if m2:
            for unit in _all_friendly_units(game, player):
                if unit.faction == code:
                    unit.apply_temp_buff(power=unit.power)
            break

    # ── Destroy weak units ──
    m = re.search(r"消灭所有攻击力≤(\d+)的单位", text)
    if m:
        threshold = int(m.group(1))
        for unit in _all_friendly_units(game, player)[:] + _all_enemy_units(game, player)[:]:
            if unit.power <= threshold:
                if unit.owner == player:
                    _kill_friendly(game, player, unit)
                else:
                    _kill_unit(game, player, unit)
        _log(game, player, "effect_destroy", f"destroy power≤{threshold}")

    # ── Next card cost reduction ──
    m = re.search(r"下一张卡的费用-(\d+)", text)
    if m:
        game.cost_reduction_next[player] = int(m.group(1))
        _log(game, player, "effect_cost_reduce", f"next card -{m.group(1)} ink")

    # ── Search deck (simplified: draw 1 matching) ──
    if "搜索" in text and "牌库" in text:
        deck = side.deck
        picked = None
        for i, c in enumerate(deck):
            if "命令" in text and c.card_type == "command":
                picked = deck.pop(i)
                break
            if "单位" in text and c.card_type in ("character", "unit"):
                picked = deck.pop(i)
                break
            if "竞赛班" in text and c.faction == COMPETITION_CLASS:
                if "费用" in text:
                    cap_m = re.search(r"费用≤(\d+)", text)
                    cap = int(cap_m.group(1)) if cap_m else 99
                    if c.cost > cap:
                        continue
                picked = deck.pop(i)
                break
        if picked:
            side.hand.append(picked)
            _log(game, player, "effect_search", f"found {picked.name}")
        else:
            _draw_n(game, player, 1)

    # ── Summon tokens ──
    m = re.search(r"召唤\s*(\d+)\s*个\s*1/1/1", text)
    if m:
        count = int(m.group(1))
        from .game_engine import CardInstance

        for i in range(count):
            if not side.can_deploy_support():
                break
            token = CardInstance(
                card_id=f"token_{source_unit.uid if source_unit else 'spell'}_{i}",
                name="召唤物",
                cost=0,
                power=1,
                grit=1,
                spirit=1,
                faction="neutral",
                card_type="unit",
                owner=player,
                keywords={"charge"},
            )
            token.base_power = token.base_grit = token.base_spirit = 1
            token.can_attack = True
            side.support_line.append(token)
        _log(game, player, "effect_summon", f"summoned {count} tokens")

    _apply_status_and_control_effects(game, player, text, target_uid=target_uid, source_unit=source_unit)

    # ── Discard after draw ──
    m = re.search(r"弃\s*(\d+)\s*张", text)
    if m and "抽" in text:
        discard_n = int(m.group(1))
        if len(side.hand) >= discard_n:
            game.request_discard(player, discard_n, source_card=source_unit)


def _apply_status_and_control_effects(
    game: GameState,
    player: int,
    text: str,
    *,
    target_uid: str | None = None,
    source_unit: CardInstance | None = None,
) -> None:
    from .unit_status import (
        apply_cannot_attack,
        apply_immune,
        apply_silence,
        grant_keyword,
    )

    # Silence
    if "沉默" in text:
        targets = []
        if "所有敌方" in text:
            targets = _all_enemy_units(game, player)
        else:
            t = _find_target(game, player, target_uid, prefer_enemy=True)
            if t:
                targets = [t]
        turns = 1
        m = re.search(r"(\d+)\s*回合", text)
        if m:
            turns = int(m.group(1))
        for t in targets:
            apply_silence(t, turns)
            _log(game, player, "effect_silence", t.name)

    # Immune + keywords
    m = re.search(r"免疫.*?(\d+)\s*回合", text)
    if m or "获得「免疫」" in text or "获得「免疫」" in text.replace(" ", ""):
        turns = int(m.group(1)) if m else 1
        target = _find_target(game, player, target_uid, prefer_enemy=False) or source_unit
        if target:
            apply_immune(target, turns)
            target.keywords.add("immune")
            _log(game, player, "effect_immune", target.name)

    if "先攻" in text and ("获得" in text or "额外获得" in text):
        target = _find_target(game, player, target_uid, prefer_enemy=False) or source_unit
        if target:
            grant_keyword(target, "first_strike")
            if "学霸" in text and target.subtype not in ("student", "学霸"):
                pass  # subtype gate — only buff if student-like
            elif "学霸" not in text or target.subtype in ("student", "teacher", ""):
                _log(game, player, "effect_keyword", f"first_strike → {target.name}")

    # Devour / destroy single enemy
    if "吞噬" in text and "消灭" in text:
        cap = 99
        cm = re.search(r"费用≤(\d+)", text)
        if cm:
            cap = int(cm.group(1))
        target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target and target.cost <= cap:
            _kill_unit(game, player, target)
            if source_unit and "获得其能力" in text and target.effect_text:
                source_unit.effect_text = (source_unit.effect_text or "") + ";" + target.effect_text
            _log(game, player, "effect_devour", target.name)

    # Mind control
    if "操控" in text:
        cap = 99
        cm = re.search(r"费用≤(\d+)", text)
        if cm:
            cap = int(cm.group(1))
        target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target and target.cost <= cap:
            target.controlled_by = player
            target.controlled_until_turn = game.turn
            _log(game, player, "effect_control", target.name)

    # Return to deck / hand
    if "返回" in text and "牌库" in text:
        target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target:
            opp = game.battlefield.opponent_side(player)
            opp.remove_unit(target)
            opp.deck.insert(0, target)
            _log(game, player, "effect_return", f"{target.name} → deck top")

    if "返回" in text and "手牌" in text:
        target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target:
            opp = game.battlefield.opponent_side(player)
            opp.remove_unit(target)
            opp.hand.append(target)
            _log(game, player, "effect_return", f"{target.name} → hand")

    # Permanent debuff
    m = re.search(r"永久\s*-(\d+)\s*攻击", text)
    if m:
        amt = int(m.group(1))
        if "随机" in text:
            target = _random_enemy_unit(game, player)
        else:
            target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target:
            target._perm_power_mod -= amt
            target.base_power = max(0, target.base_power - amt)
            target._refresh_effective_stats()

    # Cannot attack
    if "无法攻击" in text:
        target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target:
            apply_cannot_attack(target, 1)

    # -N/-N debuff on play
    m = re.search(r"使其\s*-(\d+)/-(\d+)", text)
    if m:
        pw, sp = int(m.group(1)), int(m.group(2))
        target = _find_target(game, player, target_uid, prefer_enemy=True)
        if target:
            target.base_power = max(0, target.base_power - pw)
            target.base_spirit = max(1, target.base_spirit - sp)
            target.spirit = max(1, target.spirit - sp)
            target._perm_power_mod -= pw
            target._refresh_effective_stats()


def execute_trap_effect(
    game: GameState,
    owner: int,
    trap: CardInstance,
    event,
) -> None:
    text = trap.effect_text or ""
    if "取消" in text:
        event.cancelled = True
    dmg = _parse_damage(text)
    if dmg and "使用者" in text:
        actor_side = game.battlefield.side_for(event.actor)
        actor_side.spirit_total -= dmg
        game._check_death(event.actor)
        _log(game, owner, "trap_damage", f"{dmg} → player {event.actor}")
    if "返回" in text and "牌库" in text and event.card:
        actor_side = game.battlefield.side_for(event.actor)
        if event.card in actor_side.hand:
            actor_side.hand.remove(event.card)
            actor_side.deck.insert(0, event.card)
        elif event.card in actor_side.graveyard:
            actor_side.graveyard.remove(event.card)
            actor_side.deck.insert(0, event.card)
        event.cancelled = True
    if "费用+" in text and event.card:
        m = re.search(r"费用\+(\d+)", text)
        if m:
            event.card.cost += int(m.group(1))
    if "抽" in text:
        draw_n = _parse_draw_count(text) or 1
        _draw_n(game, owner, draw_n)
    if not event.cancelled:
        execute_effect_text(game, owner, text, source_unit=trap)


def execute_reactive_text(
    game: GameState,
    player: int,
    unit: CardInstance,
    text: str,
    event,
) -> None:
    body = text
    if "当对手打出" in body:
        body = body.split("触发：", 1)[-1] if "触发：" in body else body
    if "对手每打出" in body:
        m = re.search(r"对手每打出一张卡，对其造成(\d+)点伤害", body)
        if m:
            dmg_cap = 2
            cap_m = re.search(r"最多(\d+)点", body)
            if cap_m:
                dmg_cap = int(cap_m.group(1))
            key = f"opp_play_dmg_{player}_{game.turn}"
            count = game.reactive_counters.get(key, 0)
            if count < dmg_cap:
                opp = game.battlefield.opponent_side(player)
                opp.spirit_total -= 1
                game.reactive_counters[key] = count + 1
                game._check_death(3 - player)
        return
    execute_effect_text(game, player, body, source_unit=unit)


def execute_turn_end_text(
    game: GameState,
    player: int,
    unit: CardInstance,
    text: str,
) -> None:
    for part in re.split(r"[。；]", text):
        if "回合结束时" in part or "你的回合结束时" in part:
            body = re.sub(r".*回合结束时[:：]?", "", part).strip()
            if body:
                execute_effect_text(game, player, body, source_unit=unit)


def execute_spell(
    game: GameState,
    player: int,
    card: CardInstance,
    *,
    target_uid: str | None = None,
) -> None:
    """Resolve a command/buff/counter card played from hand."""
    text = card.effect_text or card.effect_code or ""

    if not text:
        logger.warning("Spell card %s has no effect text", card.name)
        return

    if card.card_type == "command":
        game.commands_played_before_current[player] = game.commands_played_this_turn.get(
            player, 0
        )
        game.commands_played_this_turn[player] = (
            game.commands_played_this_turn.get(player, 0) + 1
        )

    execute_effect_text(
        game,
        player,
        text,
        target_uid=target_uid,
        source_unit=card,
    )


def _trigger_deathrattle(game: GameState, owner_player: int, card: CardInstance) -> None:
    text = card.effect_text or ""
    if not re.search(r"亡语", text):
        return
    if "召唤" in text or "抽" in text or "造成" in text:
        execute_effect_text(game, owner_player, text, source_unit=card)
        return
    draw_n = _parse_draw_count(text)
    if draw_n:
        _draw_n(game, owner_player, draw_n)
        _log(game, owner_player, "deathrattle", f"{card.name}: drew {draw_n}")


def execute_on_deploy(game: GameState, player: int, card: CardInstance) -> None:
    """Resolve battlecry / 出场时 effects (non-choice)."""
    from .effect_choices import parse_battlecry_choice_branches

    text = card.effect_text or ""
    if not re.search(r"出场时", text):
        return
    if parse_battlecry_choice_branches(text):
        return

    execute_effect_text(game, player, text, source_unit=card)


def execute_active_ability(
    game: GameState,
    player: int,
    card: CardInstance,
    *,
    target_uid: str | None = None,
) -> None:
    """Resolve activated / 主动 abilities on a unit in play."""
    from .unit_status import is_silenced

    if is_silenced(card):
        raise ValueError("该单位已被沉默")
    text = card.effect_text or ""
    if not re.search(r"主动[:：]|激活[:：]", text):
        raise ValueError("该卡牌没有可激活的主动能力")

    execute_effect_text(game, player, text, target_uid=target_uid, source_unit=card)
