"""Pattern-based card effect execution for CampusKards v1."""
from __future__ import annotations

import random
import re
from typing import TYPE_CHECKING

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


def _damage_unit(unit: CardInstance, amount: int) -> int:
    return unit.take_damage(amount)


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


def execute_spell(
    game: GameState,
    player: int,
    card: CardInstance,
    *,
    target_uid: str | None = None,
) -> None:
    """Resolve a command/buff/counter card played from hand."""
    text = card.effect_text or card.effect_code or ""
    side = game.battlefield.side_for(player)

    # Track command plays for conditional effects
    if card.card_type == "command":
        game.commands_played_this_turn[player] = game.commands_played_this_turn.get(player, 0) + 1

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
        _log(game, player, "effect_draw", f"{card.name}: drew {drawn}")

    # ── Direct damage ──
    dmg = _parse_damage(text)
    if dmg and ("伤害" in text or "消灭" not in text):
        target = None
        if target_uid:
            for u in _all_enemy_units(game, player):
                if u.uid == target_uid:
                    target = u
                    break
            if not target:
                for u in _all_friendly_units(game, player):
                    if u.uid == target_uid:
                        target = u
                        break
        elif "随机" in text:
            target = _random_enemy_unit(game, player)
        elif "任意目标" in text or "敌方" in text:
            target = _random_enemy_unit(game, player)

        if target:
            actual = _damage_unit(target, dmg)
            _log(game, player, "effect_damage", f"{card.name}: {actual} dmg → {target.name}")
            if not target.alive:
                if target.owner == player:
                    _kill_friendly(game, player, target)
                else:
                    _kill_unit(game, player, target)
                    game._check_death(target.owner)

    # ── AOE damage to all enemies ──
    if "所有敌方" in text and "伤害" in text:
        aoe = _parse_damage(text) or 1
        for unit in _all_enemy_units(game, player)[:]:
            _damage_unit(unit, aoe)
            if not unit.alive:
                _kill_unit(game, player, unit)
        _log(game, player, "effect_aoe", f"{card.name}: {aoe} to all enemies")

    # ── Buff all friendly units grit ──
    m = re.search(r"所有己方单位\s*\+(\d+)\s*防御", text)
    if m:
        bonus = int(m.group(1))
        for unit in _all_friendly_units(game, player):
            unit.apply_temp_buff(grit=bonus)
        _log(game, player, "effect_buff", f"{card.name}: +{bonus} grit all allies")

    # ── Buff ranged units power this turn ──
    m = re.search(r"「远程」单位本回合攻击力\+(\d+)", text)
    if m:
        bonus = int(m.group(1))
        for unit in _all_friendly_units(game, player):
            if unit.unit_type == "ranged" or "ranged" in unit.keywords:
                unit.apply_temp_buff(power=bonus)
        _log(game, player, "effect_buff", f"{card.name}: +{bonus} power to ranged")

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
        _log(game, player, "effect_destroy", f"{card.name}: destroy power≤{threshold}")

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
            _log(game, player, "effect_search", f"{card.name}: found {picked.name}")
        else:
            _draw_n(game, player, 1)

    # ── Summon tokens (simplified 1/1/1 to support line) ──
    m = re.search(r"召唤\s*(\d+)\s*个\s*1/1/1", text)
    if m:
        count = int(m.group(1))
        from .game_engine import CardInstance

        for i in range(count):
            if not side.can_deploy_support():
                break
            token = CardInstance(
                card_id=f"token_{card.uid}_{i}",
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
        _log(game, player, "effect_summon", f"{card.name}: summoned {count} tokens")

    # ── Choice: draw or summon (default draw branch) ──
    if text.startswith("抉择：") and "抽" in text:
        draw_part = re.search(r"抽\s*(\d+)\s*张", text)
        if draw_part:
            _draw_n(game, player, int(draw_part.group(1)))


def _trigger_deathrattle(game: GameState, owner_player: int, card: CardInstance) -> None:
    text = card.effect_text or ""
    if not re.search(r"亡语", text):
        return
    draw_n = _parse_draw_count(text)
    if draw_n:
        _draw_n(game, owner_player, draw_n)
        _log(game, owner_player, "deathrattle", f"{card.name}: drew {draw_n}")


def execute_on_deploy(game: GameState, player: int, card: CardInstance) -> None:
    """Resolve battlecry / 出场时 effects."""
    text = card.effect_text or ""
    if not re.search(r"出场时", text):
        return

    draw_n = _parse_draw_count(text)
    if draw_n:
        _draw_n(game, player, draw_n)
        _log(game, player, "battlecry", f"{card.name}: drew {draw_n}")

    if "随机敌方" in text and "伤害" in text:
        dmg = _parse_damage(text) or 1
        target = _random_enemy_unit(game, player)
        if target:
            _damage_unit(target, dmg)
            _log(game, player, "battlecry", f"{card.name}: {dmg} dmg → {target.name}")
            if not target.alive:
                _kill_unit(game, player, target)

    if "命令卡" in text and "抽" in text:
        side = game.battlefield.side_for(player)
        for i, c in enumerate(side.deck):
            if c.card_type == "command":
                side.hand.append(side.deck.pop(i))
                _log(game, player, "battlecry", f"{card.name}: drew command {c.name}")
                break


def execute_active_ability(
    game: GameState,
    player: int,
    card: CardInstance,
    *,
    target_uid: str | None = None,
) -> None:
    """Resolve activated / 主动 abilities on a unit in play."""
    text = card.effect_text or ""
    if not re.search(r"主动[:：]|激活[:：]", text):
        raise ValueError("该卡牌没有可激活的主动能力")

    dmg = _parse_damage(text)
    if dmg:
        target = None
        if target_uid:
            for u in _all_enemy_units(game, player) + _all_friendly_units(game, player):
                if u.uid == target_uid:
                    target = u
                    break
        else:
            target = _random_enemy_unit(game, player)
        if target:
            _damage_unit(target, dmg)
            _log(game, player, "ability", f"{card.name}: {dmg} dmg → {target.name}")
            if not target.alive and target.owner != player:
                _kill_unit(game, player, target)
        return

    draw_n = _parse_draw_count(text)
    if draw_n:
        _draw_n(game, player, draw_n)
        _log(game, player, "ability", f"{card.name}: drew {draw_n}")
        return

    raise ValueError("无法解析该主动能力")
