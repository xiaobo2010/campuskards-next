"""Tests for Redis-backed matchmaking (no Redis required — falls back gracefully)."""
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
async def test_cross_worker_status_reads_redis_active(mm: MatchmakingService, monkeypatch):
    from app.services import matchmaking as mm_mod

    async def fake_get(key: str):
        if key == "match:active:user-a":
            return "match-123"
        if key == "match:user:user-a":
            return '{"status": "matched", "match_id": "match-123", "mode": "quick"}'
        return None

    monkeypatch.setattr(mm_mod, "cache_get", fake_get)
    status = await mm.get_status("user-a")
    assert status["status"] == "matched"
    assert status["match_id"] == "match-123"


@pytest.mark.asyncio
async def test_queue_position_from_redis_mirror(mm: MatchmakingService, monkeypatch):
    import json
    from app.services import matchmaking as mm_mod

    payload = json.dumps([
        {"user_id": "a", "username": "a", "elo": 1000, "deck_id": "d1", "mode": "quick", "joined_at": 1.0},
        {"user_id": "b", "username": "b", "elo": 1100, "deck_id": "d1", "mode": "quick", "joined_at": 2.0},
    ])

    async def fake_get(key: str):
        if key == "match:queue:quick":
            return payload
        return None

    monkeypatch.setattr(mm_mod, "cache_get", fake_get)
    pos = await mm._queue_position("b", "quick")
    assert pos == 2
