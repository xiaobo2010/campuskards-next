from app.core.game_engine import create_game
from app.core.game_persistence import deserialize_game, serialize_game


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


def test_serialize_roundtrip_preserves_turn_and_hp():
    game = create_game(make_deck(), make_deck())
    game.battlefield.player1.spirit_total = 22
    game.turn = 3

    restored = deserialize_game(serialize_game(game))
    assert restored.turn == 3
    assert restored.battlefield.player1.spirit_total == 22
    assert len(restored.battlefield.player1.hand) == len(game.battlefield.player1.hand)
