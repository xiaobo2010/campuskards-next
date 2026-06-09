"""Integration tests for the leaderboard endpoint."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_leaderboard_empty(client: AsyncClient):
    """Leaderboard should return an empty list when no users exist."""
    resp = await client.get("/api/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_leaderboard_with_users(client: AsyncClient):
    """Register two users, check leaderboard entries."""
    for i in range(2):
        resp = await client.post("/api/auth/register", json={
            "username": f"player{i}",
            "email": f"p{i}@test.com",
            "password": "pass123",
        })
        assert resp.status_code == 201

    resp = await client.get("/api/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_leaderboard_ordered_by_elo(client: AsyncClient):
    """Leaderboard entries should be sorted by ELO descending."""
    names = []
    for i in range(3):
        resp = await client.post("/api/auth/register", json={
            "username": f"elo_user_{i}",
            "email": f"elo{i}@test.com",
            "password": "pass123",
        })
        assert resp.status_code == 201
        names.append(f"elo_user_{i}")

    resp = await client.get("/api/leaderboard")
    data = resp.json()
    # All registered users should appear
    registered = [e for e in data if e["username"] in names]
    # Verify descending ELO order
    elos = [e["elo"] for e in registered]
    assert elos == sorted(elos, reverse=True), "Leaderboard must be sorted by ELO descending"


@pytest.mark.asyncio
async def test_leaderboard_structure(client: AsyncClient):
    """Each leaderboard entry should have required fields."""
    await client.post("/api/auth/register", json={
        "username": "struct_user", "email": "struct@test.com", "password": "pass123",
    })

    resp = await client.get("/api/leaderboard")
    data = resp.json()
    for entry in data:
        assert "username" in entry
        assert "elo" in entry
        assert "rank" in entry
        assert isinstance(entry["rank"], int)
        assert entry["rank"] >= 1


@pytest.mark.asyncio
async def test_leaderboard_auth_not_required(client: AsyncClient):
    """Leaderboard should be accessible without authentication."""
    resp = await client.get("/api/leaderboard")
    assert resp.status_code == 200
