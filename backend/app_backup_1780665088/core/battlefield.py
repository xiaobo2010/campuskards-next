"""Battlefield data structures for CampusKards."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .game_engine import CardInstance


MAX_LINE = 5  # max units per line


@dataclass
class BattlefieldSide:
    """One player's side of the battlefield."""
    front_line: list[CardInstance] = field(default_factory=list)
    support_line: list[CardInstance] = field(default_factory=list)
    hand: list[CardInstance] = field(default_factory=list)
    deck: list[CardInstance] = field(default_factory=list)
    graveyard: list[CardInstance] = field(default_factory=list)
    ink: int = 0  # current mana/资源
    max_ink: int = 0
    spirit_total: int = 30  # player HP

    @property
    def all_units(self) -> list[CardInstance]:
        return self.front_line + self.support_line

    def can_deploy_front(self) -> bool:
        return len(self.front_line) < MAX_LINE

    def can_deploy_support(self) -> bool:
        return len(self.support_line) < MAX_LINE

    def remove_unit(self, unit: CardInstance) -> None:
        """Remove a unit from whichever line it's on."""
        if unit in self.front_line:
            self.front_line.remove(unit)
        elif unit in self.support_line:
            self.support_line.remove(unit)


@dataclass
class Battlefield:
    """Full battlefield with two sides."""
    player1: BattlefieldSide = field(default_factory=BattlefieldSide)
    player2: BattlefieldSide = field(default_factory=BattlefieldSide)

    def side_for(self, player: int) -> BattlefieldSide:
        return self.player1 if player == 1 else self.player2

    def opponent_side(self, player: int) -> BattlefieldSide:
        return self.player2 if player == 1 else self.player1
