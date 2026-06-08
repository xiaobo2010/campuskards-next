"""ELO rating adjustments for ranked matches."""


def calculate_elo_changes(winner_elo: int, loser_elo: int, *, k: int = 32) -> tuple[int, int]:
    """Return (winner_delta, loser_delta). Draw not handled here."""
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    expected_loser = 1 - expected_winner
    winner_delta = round(k * (1 - expected_winner))
    loser_delta = round(k * (0 - expected_loser))
    return winner_delta, loser_delta
