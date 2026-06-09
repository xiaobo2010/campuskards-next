"""Integration tests for deck CRUD operations."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Card


CARDS = [
    Card(id="d1", name="Deck Card 1", faction_code="key_class", card_type="character", cost=1, power=1, grit=1, spirit=1, rarity="common", is_token=False),
    Card(id="d2", name="Deck Card 2", faction_code="key_class", card_type="character", cost=2, power=2, grit=2, spirit=2, rarity="common", is_token=False),
    Card(id="d3", name="Deck Card 3", faction_code="key_class", card_type="character", cost=3, power=3, grit=3, spirit=3, rarity="common", is_token=False),
]


@pytest.fixture(autouse=True)
async def seed_cards(db: AsyncSession):
    for c in CARDS:
        db.add(c)
    await db.commit()


async def register_and_token(client: AsyncClient) -> str:
    resp = await client.post("/api/auth/register", json={
        "username": "deckmaster",
        "email": "deck@test.com",
        "password": "pass123",
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_deck(client: AsyncClient):
    token = await register_and_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/decks", headers=headers, json={
        "name": "测试卡组",
        "faction_code": "key_class",
        "cards": [{"card_id": "d1", "quantity": 3}],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "测试卡组"
    assert data["faction_code"] == "key_class"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_decks(client: AsyncClient):
    token = await register_and_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create a deck
    await client.post("/api/decks", headers=headers, json={
        "name": "卡组1", "faction_code": "key_class", "cards": [],
    })

    resp = await client.get("/api/decks", headers=headers)
    assert resp.status_code == 200
    decks = resp.json()
    assert isinstance(decks, list)
    assert len(decks) >= 1
    assert any(d["name"] == "卡组1" for d in decks)


@pytest.mark.asyncio
async def test_get_deck(client: AsyncClient):
    token = await register_and_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post("/api/decks", headers=headers, json={
        "name": "详细卡组", "faction_code": "key_class",
        "cards": [{"card_id": "d1", "quantity": 1}],
    })
    deck_id = create_resp.json()["id"]

    resp = await client.get(f"/api/decks/{deck_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == deck_id
    assert data["name"] == "详细卡组"
    assert "entries" in data


@pytest.mark.asyncio
async def test_update_deck(client: AsyncClient):
    token = await register_and_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post("/api/decks", headers=headers, json={
        "name": "旧名称", "faction_code": "key_class", "cards": [],
    })
    deck_id = create_resp.json()["id"]

    update_resp = await client.put(f"/api/decks/{deck_id}", headers=headers, json={
        "name": "新名称", "faction_code": "art_club",
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "新名称"


@pytest.mark.asyncio
async def test_delete_deck(client: AsyncClient):
    token = await register_and_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post("/api/decks", headers=headers, json={
        "name": "待删除", "faction_code": "key_class", "cards": [],
    })
    deck_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/decks/{deck_id}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/decks/{deck_id}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_validate_deck(client: AsyncClient):
    token = await register_and_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post("/api/decks", headers=headers, json={
        "name": "验证卡组", "faction_code": "key_class", "cards": [],
    })
    deck_id = create_resp.json()["id"]

    resp = await client.get(f"/api/decks/{deck_id}/validate", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "valid" in data
    assert "errors" in data


@pytest.mark.asyncio
async def test_other_users_deck_not_accessible(client: AsyncClient):
    t1 = await register_and_token(client)
    h1 = {"Authorization": f"Bearer {t1}"}

    create_resp = await client.post("/api/decks", headers=h1, json={
        "name": "私有卡组", "faction_code": "key_class", "cards": [],
    })
    deck_id = create_resp.json()["id"]

    # Register another user
    resp = await client.post("/api/auth/register", json={
        "username": "other", "email": "other@test.com", "password": "pass123",
    })
    t2 = resp.json()["access_token"]
    h2 = {"Authorization": f"Bearer {t2}"}

    get_resp = await client.get(f"/api/decks/{deck_id}", headers=h2)
    assert get_resp.status_code == 404, "Should not see other user's deck"
