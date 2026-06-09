"""Battlefield data structures for CampusKards.

Four-layer structure:
- front_line (units that can be attacked first)
- support_line (units behind front line)
- advisors (passive effects, max 3)
- player resources (ink, spirit)

Design notes:
- Corridor control: front line full (5 units) AND opponent front line empty → +1 ink per turn
- Advisors are passive effects with optional duration (-1 = permanent)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from units import Unit


MAX_FRONT_LINE = 5  # max units in front line
MAX_SUPPORT_LINE = 4  # max units in support line
MAX_ADVISORS = 3  # max advisors per player
MAX_TRAPS = 3  # max set counter/trap cards per player
MAX_LINE = MAX_FRONT_LINE  # legacy alias used by game_engine


@dataclass
class PlayerField:
    """One player's side of the battlefield.

    Layers:
    - front_line: units that can be attacked first (melee)
    - support_line: units behind front (ranged, can't be attacked while front exists)
    - advisors: passive effect cards (max 3)
    - hand, deck, graveyard: card piles
    - ink / max_ink: mana resource
    - spirit_total: player HP (default 30)
    """

    front_line: list[Unit] = field(default_factory=list)
    support_line: list[Unit] = field(default_factory=list)
    advisor_units: list[Unit] = field(default_factory=list)
    traps: list[Unit] = field(default_factory=list)
    hand: list[Unit] = field(default_factory=list)
    deck: list[Unit] = field(default_factory=list)
    graveyard: list[Unit] = field(default_factory=list)
    ink: int = 0
    max_ink: int = 0
    spirit_total: int = 30

    @property
    def all_units(self) -> list[Unit]:
        """All units on the field (front + support)."""
        return self.front_line + self.support_line

    def can_deploy_front(self) -> bool:
        """Check if front line has space."""
        return len(self.front_line) < MAX_FRONT_LINE

    def can_deploy_support(self) -> bool:
        """Check if support line has space."""
        return len(self.support_line) < MAX_SUPPORT_LINE

    def can_add_trap(self) -> bool:
        return len(self.traps) < MAX_TRAPS

    def can_add_advisor_unit(self) -> bool:
        return len(self.advisor_units) < MAX_ADVISORS

    def remove_unit(self, unit: Unit) -> None:
        """Remove a unit from whichever line it's on."""
        if unit in self.front_line:
            self.front_line.remove(unit)
        elif unit in self.support_line:
            self.support_line.remove(unit)

    def get_unit_by_uid(self, uid: str) -> Unit | None:
        """Find a unit by its unique ID."""
        for u in self.front_line:
            if u.uid == uid:
                return u
        for u in self.support_line:
            if u.uid == uid:
                return u
        return None


# Backward compatibility alias
BattlefieldSide = PlayerField


@dataclass
class Battlefield:
    """Full battlefield with two sides."""

    p1_field: PlayerField = field(default_factory=PlayerField)
    p2_field: PlayerField = field(default_factory=PlayerField)

    # Backward compatibility properties
    @property
    def player1(self) -> PlayerField:
        """Alias for p1_field."""
        return self.p1_field

    @property
    def player2(self) -> PlayerField:
        """Alias for p2_field."""
        return self.p2_field

    def side_for(self, player: int) -> PlayerField:
        """Get the field for the specified player (1 or 2)."""
        return self.p1_field if player == 1 else self.p2_field

    def opponent_side(self, player: int) -> PlayerField:
        """Get the opponent's field."""
        return self.p2_field if player == 1 else self.p1_field


# ─── Helper functions ────────────────────────────────────────────────


def check_corridor_control(field: PlayerField, opp_field: PlayerField) -> bool:
    """Check if a player has corridor control.

    Corridor control is achieved when:
    - Player's front line is full (5 units)
    - Opponent's front line is empty

    Returns True if corridor control is active.
    """
    return len(field.front_line) == MAX_FRONT_LINE and len(opp_field.front_line) == 0


def get_unit_by_uid(field: PlayerField, uid: str) -> Unit | None:
    """Find a unit by UID across front and support lines.

    This is a module-level convenience function.
    PlayerField also has a method for this.
    """
    return field.get_unit_by_uid(uid)

