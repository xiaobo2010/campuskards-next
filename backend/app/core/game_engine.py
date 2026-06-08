"""Game state machine for CampusKards."""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from enum import Enum

from .battlefield import Battlefield, BattlefieldSide, MAX_FRONT_LINE, MAX_SUPPORT_LINE
from .combat import CombatResult, compute_overflow, resolve_attack


class Phase(str, Enum):
    DRAW = "DRAW"
    MAIN = "MAIN"
    COMBAT = "COMBAT"
    END = "END"


class GameError(Exception):
    """Raised when an illegal game action is attempted."""


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
    can_attack: bool = False  # refreshed each COMBAT phase
    has_attacked: bool = False
    owner: int = 1  # player 1 or 2

    @property
    def alive(self) -> bool:
        return self.spirit > 0

    def take_damage(self, amount: int) -> int:
        """Apply damage, return actual damage taken."""
        actual = min(amount, self.spirit)
        self.spirit -= actual
        return actual


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

        # Initialize decks (shuffled)
        self.battlefield.player1.deck = self._make_instances(p1_deck_cards, player=1)
        self.battlefield.player2.deck = self._make_instances(p2_deck_cards, player=2)
        random.shuffle(self.battlefield.player1.deck)
        random.shuffle(self.battlefield.player2.deck)

        # Starting ink
        for side in (self.battlefield.player1, self.battlefield.player2):
            side.ink = starting_ink
            side.max_ink = starting_ink

        # Draw initial hands
        for _ in range(hand_size):
            self._draw_card(1)
            self._draw_card(2)

        self._log(1, "game_start", f"Game {self.id} started")
        # First player enters DRAW phase
        self._begin_draw_phase(1)

    # ─── Phase transitions ───

    def _begin_draw_phase(self, player: int) -> None:
        self.phase = Phase.DRAW
        self.current_player = player
        side = self.battlefield.side_for(player)
        side.max_ink = min(side.max_ink + 1, self.max_ink_cap)
        side.ink = side.max_ink
        self._draw_card(player)
        self._log(player, "draw_phase", f"ink refilled to {side.ink}")
        # Auto transition to MAIN
        self.phase = Phase.MAIN

    def begin_combat_phase(self) -> None:
        """Player declares entering combat phase."""
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        self.phase = Phase.COMBAT
        # Refresh all friendly units to be able to attack
        side = self.battlefield.side_for(self.current_player)
        for unit in side.all_units:
            unit.can_attack = True
            unit.has_attacked = False
        self._log(self.current_player, "combat_phase", "entered combat")

    def end_turn(self) -> None:
        """End current player's turn (allowed in MAIN or COMBAT)."""
        if self.phase not in (Phase.MAIN, Phase.COMBAT):
            raise GameError(f"Cannot end turn during {self.phase.value} phase")
        self._require_current_player()
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
            # Fatigue damage
            side.spirit_total -= 1
            self._log(player, "fatigue", f"spirit -1 (now {side.spirit_total})")
            self._check_death(player)
            return None
        card = side.deck.pop()
        side.hand.append(card)
        self._log(player, "draw", f"drew {card.name}")
        return card

    def draw(self) -> CardInstance | None:
        """Explicit draw action (if ever needed outside phase transitions)."""
        self._require_current_player()
        return self._draw_card(self.current_player)

    def deploy(self, card_uid: str, line: str = "front") -> CardInstance:
        """Deploy a card from hand to the battlefield.

        Args:
            card_uid: uid of the CardInstance in hand
            line: 'front' or 'support'
        """
        self._require_phase(Phase.MAIN)
        self._require_current_player()
        side = self.battlefield.side_for(self.current_player)

        # Find card in hand
        card = self._find_in_list(side.hand, card_uid)
        if not card:
            raise GameError(f"Card {card_uid} not in hand")

        if card.cost > side.ink:
            raise GameError(f"Not enough ink ({side.ink}/{card.cost})")

        target_line = side.front_line if line == "front" else side.support_line
        max_len = MAX_FRONT_LINE if line == "front" else MAX_SUPPORT_LINE
        if len(target_line) >= max_len:
            raise GameError(f"{line} line is full")

        side.hand.remove(card)
        side.ink -= card.cost
        target_line.append(card)
        card.can_attack = False  # summoning sickness unless charge
        self._log(self.current_player, "deploy", f"{card.name} → {line} line (ink {side.ink})")
        return card

    def attack(self, attacker_uid: str, target_uid: str | None = None) -> CombatResult:
        """Attack with a unit. If target_uid is None, attacks player face directly.

        Args:
            attacker_uid: uid of the attacking unit
            target_uid: uid of the defending unit, or None for face attack
        """
        self._require_phase(Phase.COMBAT)
        self._require_current_player()
        side = self.battlefield.side_for(self.current_player)
        opponent = self.battlefield.opponent_side(self.current_player)

        attacker = self._find_in_list(side.all_units, attacker_uid)
        if not attacker:
            raise GameError(f"Attacker {attacker_uid} not found on your side")
        if not attacker.can_attack or attacker.has_attacked:
            raise GameError(f"{attacker.name} cannot attack this turn")

        attacker.has_attacked = True

        if target_uid is None:
            # Face attack
            opponent.spirit_total -= attacker.power
            self._log(self.current_player, "attack_face",
                      f"{attacker.name} → face for {attacker.power} (spirit {opponent.spirit_total})")
            self._check_death(2 if self.current_player == 1 else 1)
            return CombatResult(attacker_survived=True, defender_survived=False,
                                damage_to_defender_hp=attacker.power)

        # Attack a specific unit
        defender = self._find_in_list(opponent.all_units, target_uid)
        if not defender:
            raise GameError(f"Target {target_uid} not found on opponent's side")

        result = resolve_attack(attacker.power, defender.grit, attacker.spirit, defender.spirit)

        overflow = compute_overflow(attacker.power, defender.grit, defender.spirit)
        defender.take_damage(max(0, attacker.power - defender.grit))
        attacker.take_damage(max(0, defender.power - attacker.grit))  # counter-attack

        if not defender.alive:
            opponent.remove_unit(defender)
            opponent.graveyard.append(defender)
            if overflow > 0:
                opponent.spirit_total -= overflow
                self._log(self.current_player, "overflow_damage",
                          f"overflow {overflow} → face (spirit {opponent.spirit_total})")
            self._check_death(2 if self.current_player == 1 else 1)

        if not attacker.alive:
            side.remove_unit(attacker)
            side.graveyard.append(attacker)

        self._log(self.current_player, "attack_unit",
                  f"{attacker.name}({attacker.power}) → {defender.name}({defender.grit}) "
                  f"[atk_alive={attacker.alive} def_alive={defender.alive}]")

        return result

    # ─── State queries ───

    def snapshot(self) -> dict:
        """Return a serializable game state snapshot."""
        return {
            "game_id": self.id,
            "turn": self.turn,
            "phase": self.phase.value,
            "current_player": self.current_player,
            "game_over": self.game_over,
            "winner": self.winner,
            "player1": self._side_snapshot(self.battlefield.player1),
            "player2": self._side_snapshot(self.battlefield.player2),
        }

    # ─── Internal helpers ───

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
        }

    @staticmethod
    def _make_instances(card_dicts: list[dict], player: int) -> list[CardInstance]:
        instances = []
        for cd in card_dicts:
            instances.append(CardInstance(
                card_id=cd["id"],
                name=cd.get("name", cd["id"]),
                cost=cd.get("cost", 0),
                power=cd.get("power", 0) or 0,
                grit=cd.get("grit", 0) or 0,
                spirit=cd.get("spirit", 0) or cd.get("hp", 0) or 1,
                faction=cd.get("faction_code", cd.get("faction", "")),
                card_type=cd.get("card_type", cd.get("type", "character")),
                owner=player,
            ))
        return instances

    @staticmethod
    def _find_in_list(lst: list[CardInstance], uid: str) -> CardInstance | None:
        for item in lst:
            if item.uid == uid:
                return item
        return None

    def _require_phase(self, expected: Phase) -> None:
        if self.phase != expected:
            raise GameError(f"Expected {expected.value} phase, currently in {self.phase.value}")

    def _require_current_player(self) -> None:
        if self.phase in (Phase.COMBAT, Phase.MAIN):
            pass  # current_player must match the acting player
        # For simplicity, we don't enforce player identity in core engine

    def _check_death(self, player: int) -> None:
        side = self.battlefield.side_for(player)
        if side.spirit_total <= 0:
            self.game_over = True
            self.winner = 2 if player == 1 else 1
            self._log(self.winner, "victory", f"Player {self.winner} wins!")

    def _log(self, player: int, action: str, detail: str = "") -> None:
        self.logs.append(GameLogEntry(phase=self.phase, player=player, action=action, detail=detail))


# ─── Convenience: create a default game from card dicts ───

def create_game(p1_cards: list[dict], p2_cards: list[dict]) -> GameState:
    """Create a new game with the given card lists for each player."""
    return GameState(p1_deck_cards=p1_cards, p2_deck_cards=p2_cards)
