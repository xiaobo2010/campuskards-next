from app.core.game_engine import create_game
from app.core.game_protocol import build_game_state, player_key


def make_deck(n=10):
    return [
        {
            "id": f"c{i}",
            "name": f"Card {i}",
            "cost": 1,
            "power": 1,
            "grit": 1,
            "spirit": 2,
            "faction_code": "key_class",
            "card_type": "unit",
        }
        for i in range(n)
    ]


def test_build_game_state_fog_of_war():
    game = create_game(make_deck(), make_deck())
    state = build_game_state(game, viewer_player=1)
    assert state["current_player"] == "p1"
    assert "hand" in state["players"]["p1"]
    assert "hand_count" in state["players"]["p2"]
    assert "hand" not in state["players"]["p2"]


def test_player_key():
    assert player_key(1) == "p1"
    assert player_key(2) == "p2"
