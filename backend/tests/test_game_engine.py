"""Unit tests for CampusKards game engine."""
import pytest
from app.core.game_engine import CardInstance, GameState, Phase, GameError, create_game
from app.core.battlefield import BattlefieldSide, MAX_LINE
from app.core.combat import resolve_attack, compute_overflow


def make_card_dict(id="test_001", name="Test Card", cost=2, power=2, grit=2, spirit=3):
    return {"id": id, "name": name, "cost": cost, "power": power,
            "grit": grit, "spirit": spirit, "faction_code": "key_class",
            "card_type": "character"}


def make_deck(n=30, **kw):
    return [make_card_dict(id=f"card_{i:03d}", **kw) for i in range(n)]


def make_game(**kw):
    return GameState(make_deck(), make_deck(), **kw)


# ─── Combat resolution ───

class TestCombat:
    def test_attack_absorbed_by_grit(self):
        result = resolve_attack(attacker_power=1, defender_grit=3, attacker_spirit=3, defender_spirit=3)
        assert result.defender_survived is True
        assert result.damage_to_defender_hp == 0

    def test_exact_kill_no_overflow(self):
        result = resolve_attack(attacker_power=5, defender_grit=2, attacker_spirit=3, defender_spirit=3)
        assert result.defender_survived is False
        assert result.damage_to_defender_hp == 3
        assert compute_overflow(5, 2, 3) == 0

    def test_overflow_damage(self):
        assert compute_overflow(10, 2, 3) == 5

    def test_no_overflow_when_absorbed(self):
        assert compute_overflow(2, 5, 3) == 0


# ─── Battlefield structure ───

class TestBattlefield:
    def test_side_defaults(self):
        side = BattlefieldSide()
        assert len(side.front_line) == 0
        assert side.ink == 0
        assert side.spirit_total == 30

    def test_deploy_limits(self):
        side = BattlefieldSide()
        for i in range(MAX_LINE):
            side.front_line.append(CardInstance(card_id=f"c{i}", name=f"U{i}", cost=1, power=1, grit=1, spirit=1))
        assert not side.can_deploy_front()
        assert side.can_deploy_support()

    def test_remove_unit(self):
        side = BattlefieldSide()
        u1 = CardInstance(card_id="a", name="A", cost=1, power=1, grit=1, spirit=1)
        u2 = CardInstance(card_id="b", name="B", cost=1, power=1, grit=1, spirit=1)
        side.front_line.append(u1)
        side.support_line.append(u2)
        side.remove_unit(u1)
        assert u1 not in side.front_line
        assert u2 in side.support_line


# ─── Game initialization ───

class TestGameInit:
    def test_game_starts(self):
        game = make_game()
        assert game.phase == Phase.MAIN
        assert game.turn == 1
        assert game.current_player == 1
        assert not game.game_over

    def test_initial_hands(self):
        # Player 1 gets hand_size + 1 (extra draw at phase start)
        # Player 2 gets exactly hand_size
        game = make_game(hand_size=5)
        assert len(game.battlefield.player1.hand) == 6
        assert len(game.battlefield.player2.hand) == 5

    def test_initial_ink(self):
        game = make_game(starting_ink=1)
        assert game.battlefield.player1.ink >= 1

    def test_deck_sizes(self):
        game = make_game(hand_size=5)
        # P1: 30 - 5 initial - 1 draw_phase = 24
        # P2: 30 - 5 initial = 25
        assert len(game.battlefield.player1.deck) == 24
        assert len(game.battlefield.player2.deck) == 25


# ─── Deploy ───

class TestDeploy:
    def test_deploy_to_front(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        card = side.hand[0]
        game.deploy(card.uid, "front")
        assert card in side.front_line
        assert card not in side.hand

    def test_deploy_to_support(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        card = side.hand[0]
        game.deploy(card.uid, "support")
        assert card in side.support_line

    def test_deploy_insufficient_ink(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        side.ink = 0
        card = side.hand[0]
        with pytest.raises(GameError, match="Not enough ink"):
            game.deploy(card.uid, "front")

    def test_deploy_wrong_phase(self):
        game = make_game(hand_size=3)
        game.phase = Phase.COMBAT
        card = game.battlefield.player1.hand[0]
        with pytest.raises(GameError, match="Expected MAIN"):
            game.deploy(card.uid, "front")

    def test_summoning_sickness(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        card = side.hand[0]
        game.deploy(card.uid, "front")
        assert card.can_attack is False


# ─── Combat phase ───

class TestCombatPhase:
    def test_enter_combat_phase(self):
        game = make_game(hand_size=3)
        game.begin_combat_phase()
        assert game.phase == Phase.COMBAT

    def test_attack_face(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        opp = game.battlefield.player2
        card = side.hand[0]
        # Make sure we can afford
        side.ink = 99
        game.deploy(card.uid, "front")
        game.begin_combat_phase()
        assert card.can_attack is True
        init_spirit = opp.spirit_total
        game.attack(card.uid, target_uid=None)
        assert opp.spirit_total == init_spirit - card.power
        assert card.has_attacked is True

    def test_attack_unit_kill(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        side.ink = 99
        atk = side.hand[0]
        atk.power = 5
        atk.grit = 1
        atk.spirit = 3
        game.deploy(atk.uid, "front")
        defender = CardInstance(card_id="def1", name="Defender", cost=1, power=1, grit=2, spirit=2, owner=2)
        game.battlefield.player2.front_line.append(defender)
        game.begin_combat_phase()
        game.attack(atk.uid, defender.uid)
        assert not defender.alive
        assert defender in game.battlefield.player2.graveyard

    def test_cannot_attack_twice(self):
        game = make_game(hand_size=3)
        side = game.battlefield.player1
        side.ink = 99
        card = side.hand[0]
        game.deploy(card.uid, "front")
        game.begin_combat_phase()
        game.attack(card.uid, target_uid=None)
        with pytest.raises(GameError, match="cannot attack"):
            game.attack(card.uid, target_uid=None)


# ─── Turn flow ───

class TestTurnFlow:
    def test_end_turn_switches_player(self):
        game = make_game(hand_size=3)
        assert game.current_player == 1
        game.end_turn()
        assert game.current_player == 2

    def test_turn_increment(self):
        game = make_game(hand_size=3)
        game.end_turn()  # p2
        game.end_turn()  # p1 again
        assert game.turn == 2
        assert game.current_player == 1

    def test_ink_refills_on_turn_start(self):
        game = make_game(hand_size=3)
        side1 = game.battlefield.player1
        side1.ink = 0
        game.end_turn()
        game.end_turn()
        assert side1.ink == side1.max_ink


# ─── Game over ───

class TestGameOver:
    def test_spirit_reaches_zero(self):
        game = make_game(hand_size=3)
        game.battlefield.player2.spirit_total = 1
        card = game.battlefield.player1.hand[0]
        card.power = 5
        game.battlefield.player1.ink = 99
        game.deploy(card.uid, "front")
        game.begin_combat_phase()
        game.attack(card.uid, target_uid=None)
        assert game.game_over is True
        assert game.winner == 1

    def test_fatigue_damage(self):
        game = make_game(hand_size=3)
        game.battlefield.player2.deck.clear()
        game.battlefield.player2.spirit_total = 1
        game.end_turn()
        assert game.game_over is True
        assert game.winner == 1


# ─── Snapshot ───

class TestSnapshot:
    def test_snapshot_structure(self):
        game = make_game(hand_size=3)
        snap = game.snapshot()
        assert "game_id" in snap
        assert snap["phase"] == "MAIN"
        assert "player1" in snap
        assert "player2" in snap
        assert isinstance(snap["player1"]["front_line"], list)
