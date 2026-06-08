import pytest

from app.services.matchmaking import MatchmakingService, QueueEntry


@pytest.fixture
def mm():
    return MatchmakingService()


def entry(user_id: str, elo: int, mode: str = "quick") -> QueueEntry:
    return QueueEntry(
        user_id=user_id,
        username=f"user_{user_id}",
        elo=elo,
        deck_id="deck-1",
        mode=mode,  # type: ignore[arg-type]
    )


@pytest.mark.asyncio
async def test_separate_queues_do_not_cross_match(mm: MatchmakingService):
    await mm.enqueue(entry("a", 1000, "quick"))
    pos, ticket = await mm.enqueue(entry("b", 1000, "ranked"))
    assert ticket is None
    assert pos == 1

    status_a = await mm.get_status("a")
    assert status_a["status"] == "queued"
    assert status_a["mode"] == "quick"


@pytest.mark.asyncio
async def test_same_mode_matches(mm: MatchmakingService):
    await mm.enqueue(entry("a", 1000, "quick"))
    pos, ticket = await mm.enqueue(entry("b", 1050, "quick"))
    assert ticket is not None
    assert ticket.mode == "quick"
    assert pos == 0


@pytest.mark.asyncio
async def test_ranked_queue_independent(mm: MatchmakingService):
    await mm.enqueue(entry("a", 1000, "ranked"))
    pos, ticket = await mm.enqueue(entry("b", 1000, "ranked"))
    assert ticket is not None
    assert ticket.mode == "ranked"
    assert pos == 0
