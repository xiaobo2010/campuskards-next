"""Choice parsing, conditional evaluation, and branch execution."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .game_engine import CardInstance, GameState


@dataclass
class ChoiceOption:
    id: str
    label: str
    branch_text: str


@dataclass
class PendingResolution:
    """Card/effect waiting for player to pick a branch."""

    player: int
    card: CardInstance | None
    context: str  # spell | deploy_battlecry | ability | discard
    options: list[ChoiceOption] = field(default_factory=list)
    target_uid: str | None = None
    deploy_line: str | None = None
    deploy_slot: int | None = None
    discard_count: int = 0


def parse_choice_branches(text: str) -> list[str] | None:
    """Split 抉择 text into branch strings."""
    if not text or "抉择" not in text:
        return None
    body = re.sub(r"^.*?抉择\s*[:：——-]*\s*", "", text).strip()
    if not body:
        return None
    parts = [p.strip() for p in re.split(r"\s*或\s*", body) if p.strip()]
    return parts if len(parts) >= 2 else None


def parse_battlecry_choice_branches(text: str) -> list[str] | None:
    if not text or "出场时" not in text or "抉择" not in text:
        return None
    m = re.search(r"出场时\s*[:：——-]*\s*(.+)", text)
    if not m:
        return None
    return parse_choice_branches("抉择：" + m.group(1).strip())


def make_choice_options(branches: list[str]) -> list[ChoiceOption]:
    return [
        ChoiceOption(id=str(i), label=_branch_label(b), branch_text=b)
        for i, b in enumerate(branches)
    ]


def _branch_label(branch: str) -> str:
    branch = branch.strip()
    if len(branch) <= 48:
        return branch
    return branch[:45] + "…"


def evaluate_condition(game: GameState, player: int, condition: str) -> bool:
    """Evaluate 若… condition clauses from effect text."""
    side = game.battlefield.side_for(player)
    hand_size = len(side.hand)

    m = re.search(r"手牌\s*≥\s*(\d+)", condition)
    if m and hand_size >= int(m.group(1)):
        return True

    m = re.search(r"手牌\s*≤\s*(\d+)", condition)
    if m and hand_size <= int(m.group(1)):
        return True

    if "本回合已打出另一张命令卡" in condition or (
        "本回合" in condition and "命令" in condition and "另一" in condition
    ):
        return game.commands_played_before_current.get(player, 0) >= 1

    if "本回合已打出命令卡" in condition:
        return game.commands_played_this_turn.get(player, 0) >= 1

    return False


def split_conditional_clauses(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Return base text and list of (condition_fragment, consequent)."""
    conditionals: list[tuple[str, str]] = []
    for m in re.finditer(
        r"若([^，。；]+)，?\s*(?:则)?([^。；]+)",
        text,
    ):
        conditionals.append((m.group(1).strip(), m.group(2).strip()))
    base = re.sub(r"若[^，。；]+，?\s*(?:则)?[^。；]+", "", text)
    base = re.sub(r"[。；]\s*$", "", base.strip())
    return base.strip(), conditionals


def pending_resolution_public(pr: PendingResolution) -> dict:
    payload = {
        "source_uid": pr.card.uid if pr.card else None,
        "source_name": pr.card.name if pr.card else "",
        "context": pr.context,
        "target_uid": pr.target_uid,
        "options": [
            {"id": o.id, "label": o.label, "branch_text": o.branch_text}
            for o in pr.options
        ],
    }
    if pr.context == "discard":
        payload["discard_count"] = pr.discard_count
    return payload


def branch_needs_target(branch_text: str) -> bool:
    """True when the player must pick a board target to resolve this branch."""
    if "随机" in branch_text or "任意目标" in branch_text:
        return False
    patterns = (
        r"对.*?单位.*?造成",
        r"对一个.*?造成",
        r"使一个单位",
        r"进入一个单位",
    )
    return any(re.search(p, branch_text) for p in patterns)


def resolve_branch(
    game: GameState,
    player: int,
    branch_text: str,
    *,
    target_uid: str | None = None,
    source_unit: CardInstance | None = None,
) -> None:
    """Execute a single choice branch or conditional consequent."""
    from . import effect_engine

    effect_engine.execute_effect_text(
        game,
        player,
        branch_text,
        target_uid=target_uid,
        source_unit=source_unit,
        skip_choice=True,
    )
