from app.services.elo import calculate_elo_changes


def test_elo_favorite_wins_less():
    w, l = calculate_elo_changes(1500, 1200)
    assert w < 32
    assert l < 0


def test_elo_underdog_wins_more():
    w, l = calculate_elo_changes(1200, 1500)
    assert w > 16
    assert l < -16
