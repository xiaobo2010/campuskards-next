"""Tests for PVE heuristic AI."""
from app.core.game_engine import CardInstance, GameState, Phase, create_game
from app.services.pve_ai import decide_bot_actions


def _minimal_card(**kwargs) -> dict:
    base = {
        "id": "c1",
        "name": "Test Unit",
        "cost": 2,
        "power": 3,
        "grit": 1,
        "spirit": 2,
        "faction_code": "key_class",
        "card_type": "character",
        "effect_text": "",
        "effect_code": "",
        "subtype": "melee",
    }
    base.update(kwargs)
    return base


def test_bot_decides_end_turn_on_empty_hand():
    game = create_game([], [])
    game.current_player = 2
    game.phase = Phase.MAIN
    side = game.battlefield.player2
    side.hand.clear()
    side.ink = 5

    actions = decide_bot_actions(game, 2)
    kinds = [a.kind for a in actions]
    assert "end_turn" in kinds


def test_bot_deploys_affordable_unit():
    p1 = [_minimal_card(id=f"p{i}") for i in range(30)]
    p2 = [_minimal_card(id=f"b{i}", cost=1, power=2) for i in range(30)]
    game = create_game(p1, p2)
    game.current_player = 2
    game.phase = Phase.MAIN
    side = game.battlefield.player2
    side.hand.clear()
    side.hand.append(
        CardInstance(
            card_id="u1",
            name="Grunt",
            cost=1,
            power=2,
            grit=1,
            spirit=2,
            card_type="character",
            owner=2,
        )
    )
    side.ink = 3

    actions = decide_bot_actions(game, 2)
    assert any(a.kind == "play_card" for a in actions)


def test_bot_includes_combat_when_units_on_board():
    game = create_game([_minimal_card()] * 30, [_minimal_card()] * 30)
    game.current_player = 2
    game.phase = Phase.COMBAT
    unit = CardInstance(
        card_id="u1",
        name="Fighter",
        cost=2,
        power=4,
        grit=1,
        spirit=3,
        card_type="character",
        owner=2,
        can_attack=True,
    )
    game.battlefield.player2.front_line.append(unit)

    actions = decide_bot_actions(game, 2)
    assert any(a.kind == "attack" for a in actions)
