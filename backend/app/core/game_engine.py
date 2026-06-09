"""Game state machine for CampusKards."""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from enum import Enum

from .battlefield import MAX_FRONT_LINE, MAX_SUPPORT_LINE, Battlefield, BattlefieldSide, check_corridor_control
from .card_keywords import infer_unit_type, is_advisor_card, parse_keywords
from .combat import CombatResult, compute_overflow, resolve_attack
from .combat_rules import can_attack_target
from .effect_choices import (
    PendingResolution,
    branch_needs_target,
    make_choice_options,
    parse_battlecry_choice_branches,
    parse_choice_branches,
    pending_resolution_public,
    resolve_branch,
)
from .effect_engine import execute_active_ability, execute_on_deploy, execute_spell
from .faction_passives import (
    apply_faction_stat_passives,
    apply_turn_start_passives,
    arts_first_command_discount,
    mark_arts_command_discount_used,
)
from .faction_synergy import apply_all_synergies
from .triggers import (
    PlayEvent,
    PlayEventKind,
    check_traps_on_play,
    classify_play_event,
    fire_defender_reactive_units,
    fire_opponent_play_hooks,
    fire_turn_end_effects,
    is_counter_card,
    is_trap_effect,
)
from .unit_status import is_silenced, tick_statuses_for_player


class Phase(str, Enum):
    DRAW = "DRAW"
    MAIN = "MAIN"
    COMBAT = "COMBAT"
    END = "END"


class GameError(Exception):
    """Raised when an illegal game action is attempted."""


UNIT_CARD_TYPES = frozenset({"character", "unit"})
SPELL_CARD_TYPES = frozenset({"command", "event", "buff"})


def is_unit_card(card_type: str) -> bool:
    return card_type.lower() in UNIT_CARD_TYPES


def is_spell_card(card_type: str) -> bool:
    return (card_type or "").lower() in SPELL_CARD_TYPES


@dataclass
class CardInstance:
    """A runtime instance of a card on the battlefield."""
    card_id: str
    name: str
    cost: int
    power: int
    grit: int
    spirit: int  # unit HP
    faction: str = ""
    card_type: str = "character"
    uid: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    can_attack: bool = False
    has_attacked: bool = False
    owner: int = 1
    effect_text: str = ""
    effect_code: str = ""
    unit_type: str = "melee"
    subtype: str = ""
    keywords: set[str] = field(default_factory=set)
    synergy_tags: list[str] = field(default_factory=list)
    immune_turns: int = 0
    silenced_turns: int = 0
    cannot_attack_turns: int = 0
    controlled_by: int | None = None
    controlled_until_turn: int = 0
    base_power: int = 0
    base_grit: int = 0
    base_spirit: int = 0
    _synergy_power: int = 0
    _synergy_grit: int = 0
    _synergy_spirit_bonus: int = 0
    _local_synergy_power: int = 0
    _faction_passive_power: int = 0
    _perm_power_mod: int = 0
    _temp_power: int = 0
    _temp_grit: int = 0
    _temp_spirit: int = 0
    summoned_this_turn: bool = False

    def __post_init__(self) -> None:
        if not self.base_power and self.power:
            self.base_power = self.power
        if not self.base_grit and self.grit:
            self.base_grit = self.grit
        if not self.base_spirit and self.spirit:
            self.base_spirit = self.spirit
        if isinstance(self.keywords, list):
            self.keywords = set(self.keywords)

    @property
    def alive(self) -> bool:
        return self.spirit > 0

    def take_damage(self, amount: int) -> int:
        if amount > 0 and self.immune_turns > 0:
            return 0
        actual = min(amount, self.spirit)
        self.spirit -= actual
        return actual

    def apply_synergy_buffs(
        self,
        power: int,
        grit: int,
        spirit_bonus: int,
        tags: list[str],
        *,
        local_power: int = 0,
    ) -> None:
        spirit_delta = spirit_bonus - self._synergy_spirit_bonus
        self._synergy_power = power
        self._synergy_grit = grit
        self._synergy_spirit_bonus = spirit_bonus
        self._local_synergy_power = local_power
        self.synergy_tags = tags
        if spirit_delta > 0:
            self.spirit += spirit_delta
        self._refresh_effective_stats()

    def apply_temp_buff(
        self,
        *,
        power: int = 0,
        grit: int = 0,
        spirit: int = 0,
    ) -> None:
        self._temp_power += power
        self._temp_grit += grit
        if spirit:
            self._temp_spirit += spirit
            self.spirit += spirit
        self._refresh_effective_stats()

    def clear_temp_buffs(self) -> None:
        if self._temp_spirit:
            self.spirit = max(1, self.spirit - self._temp_spirit)
        self._temp_power = 0
        self._temp_grit = 0
        self._temp_spirit = 0
        self._refresh_effective_stats()

    def _refresh_effective_stats(self) -> None:
        self.power = max(
            0,
            self.base_power
            + self._synergy_power
            + self._local_synergy_power
            + self._faction_passive_power
            + self._perm_power_mod
            + self._temp_power,
        )
        self.grit = max(
            0,
            self.base_grit + self._synergy_grit + self._temp_grit,
        )


@dataclass
class GameLogEntry:
    phase: Phase
    player: int
    action: str
    detail: str = ""


class GameState:
    """Full game state with state machine and operations."""

    def __init__(
        self,
        p1_deck_cards: list[dict],
        p2_deck_cards: list[dict],
        *,
        starting_ink: int = 1,
        max_ink_cap: int = 10,
        hand_size: int = 5,
        p1_starting_hp: int = 30,
        p2_starting_hp: int = 30,
    ) -> None:
        self.id = uuid.uuid4().hex[:8]
        self.battlefield = Battlefield()
        self.phase = Phase.DRAW
        self.current_player = 1
        self.turn = 1
        self.max_ink_cap = max_ink_cap
        self.hand_size = hand_size
        self.logs: list[GameLogEntry] = []
        self.game_over = False
        self.winner: int | None = None
        self.starting_hp = {1: p1_starting_hp, 2: p2_starting_hp}
        self.attacks_this_turn: dict[int, int] = {1: 0, 2: 0}
        self.commands_played_this_turn: dict[int, int] = {1: 0, 2: 0}
        self.commands_played_before_current: dict[int, int] = {1: 0, 2: 0}
        self.cost_reduction_next: dict[int, int] = {1: 0, 2: 0}
        self.corridor_controller: int | None = None
        self.pending_resolution: PendingResolution | None = None
        self.arts_command_discount_used: dict[int, bool] = {1: False, 2: False}
        self.reactive_counters: dict[str, int] = {}
        self.cards_played_this_turn: dict[int, int] = {1: 0, 2: 0}

        self.battlefield.player1.deck = self._make_instances(p1_deck_cards, player=1)
        self.battlefield.player2.deck = self._make_instances(p2_deck_cards, player=2)
        random.shuffle(self.battlefield.player1.deck)
        random.shuffle(self.battlefield.player2.deck)

        self.battlefield.player1.spirit_total = p1_starting_hp
        self.battlefield.player2.spirit_total = p2_starting_hp

        for side in (self.battlefield.player1, self.battlefield.player2):
            side.ink = starting_ink
            side.max_ink = starting_ink

        for _ in range(hand_size):
            self._draw_card(1)
            self._draw_card(2)

        self._log(1, "game_start", f"Game {self.id} started")
        self._begin_draw_phase(1)

    # ─── Phase transitions ───

    def _begin_draw_phase(self, player: int) -> None:
        self.phase = Phase.DRAW
        self.current_player = player
        side = self.battlefield.side_for(player)
        opp = self.battlefield.opponent_side(player)

        self.attacks_this_turn[player] = 0
        self.commands_played_this_turn[player] = 0
        self.commands_played_before_current[player] = 0
        self.cost_reduction_next[player] = 0
        self.cards_played_this_turn[player] = 0
        self.pending_resolution = None

        tick_statuses_for_player(self, player)

        for u in side.all_units:
            u.clear_temp_buffs()
            u.summoned_this_turn = False

        side.max_ink = min(side.max_ink + 1, self.max_ink_cap)
        side.ink = side.max_ink

        self._update_corridor_control()
        if self.corridor_controller == player:
            side.ink += 1
            self._log(player, "corridor_bonus", "+1 ink from corridor control")

        self._draw_card(player)
        apply_turn_start_passives(self, player)
        apply_all_synergies(self)
        self._log(player, "draw_phase", f"ink refilled to {side.ink}")
        self.phase = Phase.MAIN

    def begin_combat_phase(self) -> None:
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        self.phase = Phase.COMBAT
        side = self.battlefield.side_for(self.current_player)
        apply_all_synergies(self)
        for unit in side.all_units:
            if not unit.summoned_this_turn and unit.cannot_attack_turns <= 0:
                unit.can_attack = True
            unit.has_attacked = False
        self._log(self.current_player, "combat_phase", "entered combat")

    def end_turn(self) -> None:
        if self.phase not in (Phase.MAIN, Phase.COMBAT):
            raise GameError(f"Cannot end turn during {self.phase.value} phase")
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        fire_turn_end_effects(self, player)
        self.phase = Phase.END
        next_player = 2 if self.current_player == 1 else 1
        self._log(self.current_player, "end_turn", f"turn {self.turn} ended")
        self.current_player = next_player
        if next_player == 1:
            self.turn += 1
        self._begin_draw_phase(next_player)

    # ─── Core operations ───

    def _draw_card(self, player: int) -> CardInstance | None:
        side = self.battlefield.side_for(player)
        if not side.deck:
            side.spirit_total -= 1
            self._log(player, "fatigue", f"spirit -1 (now {side.spirit_total})")
            self._check_death(player)
            return None
        card = side.deck.pop()
        side.hand.append(card)
        self._log(player, "draw", f"drew {card.name}")
        return card

    def draw(self) -> CardInstance | None:
        self._require_current_player()
        return self._draw_card(self.current_player)

    def _effective_cost(self, card: CardInstance, player: int) -> int:
        reduction = self.cost_reduction_next.get(player, 0)
        reduction += arts_first_command_discount(self, player, card)
        return max(0, card.cost - reduction)

    def request_discard(
        self,
        player: int,
        count: int,
        *,
        source_card: CardInstance | None = None,
    ) -> None:
        side = self.battlefield.side_for(player)
        if count <= 0 or len(side.hand) < count:
            return
        self.pending_resolution = PendingResolution(
            player=player,
            card=source_card,
            context="discard",
            discard_count=count,
        )
        self._log(player, "discard_choice", f"discard {count} card(s)")

    def resolve_discard(self, card_uids: list[str]) -> None:
        pr = self.pending_resolution
        if not pr or pr.context != "discard":
            raise GameError("No pending discard")
        if pr.player != self.current_player:
            raise GameError("Not your turn")
        if len(card_uids) != pr.discard_count:
            raise GameError(f"Must discard exactly {pr.discard_count} cards")
        side = self.battlefield.side_for(pr.player)
        for uid in card_uids:
            card = self._find_in_list(side.hand, uid)
            if not card:
                raise GameError(f"Card {uid} not in hand")
            side.hand.remove(card)
            side.graveyard.append(card)
        self.pending_resolution = None
        self._log(pr.player, "discard", f"discarded {len(card_uids)}")
        if pr.card and pr.card not in side.graveyard and pr.card not in side.hand:
            side.graveyard.append(pr.card)

    def _after_card_play(self, player: int, card: CardInstance) -> None:
        self.cards_played_this_turn[player] = self.cards_played_this_turn.get(player, 0) + 1
        mark_arts_command_discount_used(self, player, card)
        event = PlayEvent(
            actor=player,
            card=card,
            kind=classify_play_event(card),
            cost=card.cost,
        )
        fire_opponent_play_hooks(self, event)
        fire_defender_reactive_units(self, event)
        apply_faction_stat_passives(self, player)
        apply_faction_stat_passives(self, 3 - player)

    def play_spell(
        self,
        card_uid: str,
        *,
        target_uid: str | None = None,
    ) -> CardInstance:
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        side = self.battlefield.side_for(player)

        card = self._find_in_list(side.hand, card_uid)
        if not card:
            raise GameError(f"Card {card_uid} not in hand")
        if is_unit_card(card.card_type):
            raise GameError(f"{card.name} is a unit — deploy to a battle line")

        if is_counter_card(card.card_type) or is_trap_effect(card.effect_text or ""):
            return self.play_trap(card_uid)

        cost = self._effective_cost(card, player)
        if cost > side.ink:
            raise GameError(f"Not enough ink ({side.ink}/{cost})")

        side.hand.remove(card)
        side.ink -= cost
        if self.cost_reduction_next.get(player, 0) > 0:
            self.cost_reduction_next[player] = 0

        event = PlayEvent(
            actor=player,
            card=card,
            kind=classify_play_event(card),
            cost=cost,
        )
        if check_traps_on_play(self, event):
            side.graveyard.append(card)
            self._log(player, "play_spell", f"{card.name} cancelled by trap")
            return card

        effect_text = card.effect_text or card.effect_code or ""
        branches = parse_choice_branches(effect_text)
        if branches:
            self.pending_resolution = PendingResolution(
                player=player,
                card=card,
                context="spell",
                options=make_choice_options(branches),
                target_uid=target_uid,
            )
            self._log(player, "effect_choice", f"{card.name}: awaiting choice")
            return card

        execute_spell(self, player, card, target_uid=target_uid)
        if self.pending_resolution and self.pending_resolution.context == "discard":
            if self.pending_resolution.card is None:
                self.pending_resolution.card = card
            return card
        side.graveyard.append(card)
        apply_all_synergies(self)
        self._after_card_play(player, card)
        self._log(player, "play_spell", f"{card.name} played (ink {side.ink})")
        return card

    def play_trap(self, card_uid: str) -> CardInstance:
        """Set a counter/trap card from hand."""
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        side = self.battlefield.side_for(player)

        card = self._find_in_list(side.hand, card_uid)
        if not card:
            raise GameError(f"Card {card_uid} not in hand")
        if not (is_counter_card(card.card_type) or is_trap_effect(card.effect_text or "")):
            raise GameError(f"{card.name} is not a trap/counter card")

        if not side.can_add_trap():
            raise GameError("Trap zone is full")

        cost = self._effective_cost(card, player)
        if cost > side.ink:
            raise GameError(f"Not enough ink ({side.ink}/{cost})")

        side.hand.remove(card)
        side.ink -= cost
        side.traps.append(card)
        self._log(player, "set_trap", f"{card.name} set (ink {side.ink})")
        return card

    def resolve_effect_choice(
        self,
        choice_id: str,
        *,
        target_uid: str | None = None,
    ) -> None:
        """Resolve a pending 抉择 branch."""
        self._require_current_player()
        pr = self.pending_resolution
        if not pr:
            raise GameError("No pending effect choice")
        if pr.player != self.current_player:
            raise GameError("Not your turn")

        option = next((o for o in pr.options if o.id == choice_id), None)
        if not option:
            raise GameError(f"Invalid choice {choice_id}")

        effective_target = target_uid or pr.target_uid
        if branch_needs_target(option.branch_text) and not effective_target:
            raise GameError("This choice requires a target")

        source_unit = pr.card if pr.context != "spell" else None
        resolve_branch(
            self,
            pr.player,
            option.branch_text,
            target_uid=effective_target,
            source_unit=source_unit,
        )

        side = self.battlefield.side_for(pr.player)
        if pr.context == "spell" and pr.card:
            side.graveyard.append(pr.card)

        self.pending_resolution = None
        apply_all_synergies(self)
        if pr.card and pr.context == "spell":
            self._after_card_play(pr.player, pr.card)
        self._log(pr.player, "resolve_choice", f"{pr.card.name if pr.card else 'discard'}: {option.label}")

    def deploy(
        self,
        card_uid: str,
        line: str = "front",
        slot: int | None = None,
    ) -> CardInstance:
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        side = self.battlefield.side_for(player)

        card = self._find_in_list(side.hand, card_uid)
        if not card:
            raise GameError(f"Card {card_uid} not in hand")
        if not is_unit_card(card.card_type):
            raise GameError(f"{card.name} is not a unit — use play from hand")

        if is_advisor_card(card.effect_text or "", card.subtype):
            return self._deploy_advisor(card, player, side)

        if (
            line == "support"
            and card.unit_type == "melee"
            and "flying" not in card.keywords
            and card.unit_type != "ranged"
            and "ranged" not in card.keywords
        ):
            raise GameError("Melee units must deploy to the front line")

        cost = self._effective_cost(card, player)
        if cost > side.ink:
            raise GameError(f"Not enough ink ({side.ink}/{cost})")

        target_line = side.front_line if line == "front" else side.support_line
        max_len = MAX_FRONT_LINE if line == "front" else MAX_SUPPORT_LINE
        if len(target_line) >= max_len:
            raise GameError(f"{line} line is full")

        side.hand.remove(card)
        side.ink -= cost
        if self.cost_reduction_next.get(player, 0) > 0:
            self.cost_reduction_next[player] = 0

        event = PlayEvent(
            actor=player,
            card=card,
            kind=PlayEventKind.UNIT,
            cost=cost,
        )
        if check_traps_on_play(self, event):
            side.graveyard.append(card)
            self._log(player, "deploy", f"{card.name} cancelled by trap")
            return card

        insert_at = len(target_line) if slot is None else max(0, min(slot, len(target_line)))
        target_line.insert(insert_at, card)

        card.summoned_this_turn = True
        card.can_attack = "charge" in card.keywords

        battlecry_branches = parse_battlecry_choice_branches(card.effect_text or "")
        if battlecry_branches:
            self.pending_resolution = PendingResolution(
                player=player,
                card=card,
                context="deploy_battlecry",
                options=make_choice_options(battlecry_branches),
                deploy_line=line,
                deploy_slot=insert_at,
            )
            apply_all_synergies(self)
            self._log(player, "effect_choice", f"{card.name}: battlecry choice")
            return card

        execute_on_deploy(self, player, card)
        apply_all_synergies(self)
        self._after_card_play(player, card)
        self._log(
            player,
            "deploy",
            f"{card.name} → {line} line slot {insert_at} (ink {side.ink})",
        )
        return card

    def _deploy_advisor(
        self,
        card: CardInstance,
        player: int,
        side: BattlefieldSide,
    ) -> CardInstance:
        if not side.can_add_advisor_unit():
            raise GameError("Advisor slots are full")
        cost = self._effective_cost(card, player)
        if cost > side.ink:
            raise GameError(f"Not enough ink ({side.ink}/{cost})")
        side.hand.remove(card)
        side.ink -= cost
        card.can_attack = False
        side.advisor_units.append(card)
        execute_on_deploy(self, player, card)
        apply_all_synergies(self)
        self._after_card_play(player, card)
        self._log(player, "deploy_advisor", f"{card.name} → advisor slot")
        return card

    def move_unit(self, unit_uid: str, to_line: str) -> CardInstance:
        """Move a unit between front and support lines."""
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        side = self.battlefield.side_for(player)

        unit = self._find_in_list(side.all_units, unit_uid)
        if not unit:
            raise GameError(f"Unit {unit_uid} not found")

        if unit.unit_type == "melee" and "flying" not in unit.keywords and to_line == "support":
            raise GameError("Melee units cannot move to support line")

        cost = 0 if unit.unit_type == "flying" or "flying" in unit.keywords else 1
        if cost > side.ink:
            raise GameError("Not enough ink to move")

        dest = side.front_line if to_line == "front" else side.support_line
        max_len = MAX_FRONT_LINE if to_line == "front" else MAX_SUPPORT_LINE
        if len(dest) >= max_len:
            raise GameError(f"{to_line} line is full")

        side.remove_unit(unit)
        dest.append(unit)
        side.ink -= cost
        self._log(player, "move_unit", f"{unit.name} → {to_line}")
        return unit

    def attack(self, attacker_uid: str, target_uid: str | None = None) -> CombatResult:
        self._require_phase(Phase.COMBAT)
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        side = self.battlefield.side_for(player)
        opponent = self.battlefield.opponent_side(player)

        attacker = self._find_in_list(side.all_units, attacker_uid)
        if not attacker:
            raise GameError(f"Attacker {attacker_uid} not found on your side")
        if not attacker.can_attack or attacker.has_attacked:
            raise GameError(f"{attacker.name} cannot attack this turn")

        apply_all_synergies(self)
        attacker.has_attacked = True
        self.attacks_this_turn[player] = self.attacks_this_turn.get(player, 0) + 1
        apply_all_synergies(self)

        atk_power = attacker.power

        if target_uid is None:
            opponent.spirit_total -= atk_power
            self._log(
                player,
                "attack_face",
                f"{attacker.name} → face for {atk_power} (spirit {opponent.spirit_total})",
            )
            self._check_death(2 if player == 1 else 1)
            return CombatResult(
                attacker_survived=True,
                defender_survived=False,
                damage_to_defender_hp=atk_power,
            )

        defender = self._find_in_list(opponent.all_units, target_uid)
        if not defender:
            raise GameError(f"Target {target_uid} not found on opponent's side")

        if not can_attack_target(attacker, defender, opponent):
            raise GameError(
                "Cannot attack support line while opponent has units on the front line"
            )

        from .combat_rules import apply_combat_damage_to_unit

        result = resolve_attack(
            atk_power,
            defender.grit,
            attacker.spirit,
            defender.spirit,
        )

        overflow = compute_overflow(atk_power, defender.grit, defender.spirit)
        dmg_to_def = max(0, atk_power - defender.grit)
        apply_combat_damage_to_unit(
            defender, dmg_to_def, attacker_power=atk_power, is_combat=True
        )

        no_counter = (
            "ranged" in attacker.keywords
            or attacker.unit_type == "ranged"
            or "first_strike" in attacker.keywords
        )
        if not no_counter:
            counter_dmg = max(0, defender.power - attacker.grit)
            apply_combat_damage_to_unit(
                attacker, counter_dmg, attacker_power=defender.power, is_combat=True
            )

        if not defender.alive:
            from .effect_engine import _trigger_deathrattle

            opponent.remove_unit(defender)
            opponent.graveyard.append(defender)
            _trigger_deathrattle(self, defender.owner, defender)
            if overflow > 0:
                opponent.spirit_total -= overflow
                self._log(
                    player,
                    "overflow_damage",
                    f"overflow {overflow} → face (spirit {opponent.spirit_total})",
                )
            self._check_death(2 if player == 1 else 1)

        if not attacker.alive:
            side.remove_unit(attacker)
            side.graveyard.append(attacker)

        apply_all_synergies(self)
        self._log(
            player,
            "attack_unit",
            f"{attacker.name}({atk_power}) → {defender.name}({defender.grit}) "
            f"[atk_alive={attacker.alive} def_alive={defender.alive}]",
        )
        return result

    def use_ability(
        self,
        card_uid: str,
        *,
        target_uid: str | None = None,
    ) -> None:
        """Activate a unit's on-board ability (主动/激活)."""
        self._require_current_player()
        self._require_no_pending()
        player = self.current_player
        side = self.battlefield.side_for(player)

        unit = self._find_in_list(side.all_units, card_uid)
        if not unit:
            raise GameError(f"Unit {card_uid} not on your battlefield")
        if is_silenced(unit):
            raise GameError("该单位已被沉默")

        try:
            execute_active_ability(self, player, unit, target_uid=target_uid)
        except ValueError as exc:
            raise GameError(str(exc)) from exc

        apply_all_synergies(self)

    def _update_corridor_control(self) -> None:
        p1 = self.battlefield.player1
        p2 = self.battlefield.player2
        if check_corridor_control(p1, p2):
            self.corridor_controller = 1
        elif check_corridor_control(p2, p1):
            self.corridor_controller = 2
        else:
            self.corridor_controller = None

    def snapshot(self) -> dict:
        return {
            "game_id": self.id,
            "turn": self.turn,
            "phase": self.phase.value,
            "current_player": self.current_player,
            "game_over": self.game_over,
            "winner": self.winner,
            "corridor_controller": self.corridor_controller,
            "player1": self._side_snapshot(self.battlefield.player1),
            "player2": self._side_snapshot(self.battlefield.player2),
        }

    def _side_snapshot(self, side: BattlefieldSide) -> dict:
        return {
            "ink": side.ink,
            "max_ink": side.max_ink,
            "spirit_total": side.spirit_total,
            "hand_size": len(side.hand),
            "deck_size": len(side.deck),
            "front_line": [self._unit_snapshot(u) for u in side.front_line],
            "support_line": [self._unit_snapshot(u) for u in side.support_line],
            "graveyard_size": len(side.graveyard),
        }

    @staticmethod
    def _unit_snapshot(unit: CardInstance) -> dict:
        return {
            "uid": unit.uid,
            "card_id": unit.card_id,
            "name": unit.name,
            "power": unit.power,
            "grit": unit.grit,
            "spirit": unit.spirit,
            "can_attack": unit.can_attack and not unit.has_attacked,
            "synergy_tags": unit.synergy_tags,
            "unit_type": unit.unit_type,
            "keywords": sorted(unit.keywords),
        }

    @staticmethod
    def _make_instances(card_dicts: list[dict], player: int) -> list[CardInstance]:
        instances = []
        for cd in card_dicts:
            effect_text = cd.get("effect_text", "") or ""
            keywords = parse_keywords(effect_text)
            unit_type = infer_unit_type(keywords, cd.get("subtype"))
            power = cd.get("power", 0) or 0
            grit = cd.get("grit", 0) or 0
            spirit = cd.get("spirit", 0) or cd.get("hp", 0) or 1
            instances.append(
                CardInstance(
                    card_id=cd["id"],
                    name=cd.get("name", cd["id"]),
                    cost=cd.get("cost", 0),
                    power=power,
                    grit=grit,
                    spirit=spirit,
                    base_power=power,
                    base_grit=grit,
                    base_spirit=spirit,
                    faction=cd.get("faction_code", cd.get("faction", "")),
                    card_type=cd.get("card_type", cd.get("type", "character")),
                    owner=player,
                    effect_text=effect_text,
                    effect_code=cd.get("effect_code", "") or "",
                    unit_type=unit_type,
                    keywords=keywords,
                    subtype=cd.get("subtype", cd.get("unit_type", "")) or "",
                )
            )
        return instances

    @staticmethod
    def _find_in_list(lst: list[CardInstance], uid: str) -> CardInstance | None:
        for item in lst:
            if item.uid == uid:
                return item
        return None

    def _require_phase(self, expected: Phase) -> None:
        if self.phase != expected:
            raise GameError(
                f"Expected {expected.value} phase, currently in {self.phase.value}"
            )

    def pending_choice_public(self) -> dict | None:
        if not self.pending_resolution:
            return None
        return pending_resolution_public(self.pending_resolution)

    def _require_no_pending(self) -> None:
        if self.pending_resolution:
            raise GameError("Resolve pending effect choice first")

    def _require_current_player(self) -> None:
        pass

    def _check_death(self, player: int) -> None:
        side = self.battlefield.side_for(player)
        if side.spirit_total <= 0:
            self.game_over = True
            self.winner = 2 if player == 1 else 1
            self._log(self.winner, "victory", f"Player {self.winner} wins!")

    def _log(self, player: int, action: str, detail: str = "") -> None:
        self.logs.append(
            GameLogEntry(phase=self.phase, player=player, action=action, detail=detail)
        )


def create_game(
    p1_cards: list[dict],
    p2_cards: list[dict],
    *,
    p1_starting_hp: int = 30,
    p2_starting_hp: int = 30,
    max_ink_cap: int = 10,
) -> GameState:
    return GameState(
        p1_deck_cards=p1_cards,
        p2_deck_cards=p2_cards,
        p1_starting_hp=p1_starting_hp,
        p2_starting_hp=p2_starting_hp,
        max_ink_cap=max_ink_cap,
    )
