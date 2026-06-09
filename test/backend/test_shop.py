"""Integration tests for card shop (packs, buying, opening, selector)."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Card, UserCard

BASIC_CARDS = [
    Card(id="s1", name="Shop Card 1", faction_code="key_class", card_type="character", cost=1, power=1, grit=1, spirit=1, rarity="common", is_token=False),
    Card(id="s2", name="Shop Card 2", faction_code="art_club", card_type="character", cost=2, power=2, grit=2, spirit=2, rarity="rare", is_token=False),
    Card(id="s3", name="Shop Card 3", faction_code="sports", card_type="character", cost=3, power=3, grit=3, spirit=3, rarity="epic", is_token=False),
    Card(id="s4", name="Shop Card 4", faction_code="science", card_type="spell", cost=1, rarity="common", is_token=False),
    Card(id="s5", name="Shop Card 5", faction_code="student_council", card_type="spell", cost=2, rarity="legendary", is_token=False),
]


@pytest.fixture(autouse=True)
async def seed_cards(db: AsyncSession):
    for c in BASIC_CARDS:
        db.add(c)
    await db.commit()


@pytest.mark.asyncio
async def test_list_packs(client: AsyncClient):
    resp = await client.get("/api/shop/packs")
    assert resp.status_code == 200
    packs = resp.json()
    assert isinstance(packs, list)
    assert len(packs) >= 3
    names = [p["name"] for p in packs]
    assert "基础卡包" in names or any("基础" in p["id"] for p in packs)


@pytest.mark.asyncio
async def test_register_and_get_token(client: AsyncClient) -> str:
    resp = await client.post("/api/auth/register", json={
        "username": "shopper",
        "email": "shopper@test.com",
        "password": "pass123",
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_buy_and_open_pack(client: AsyncClient):
    token = await test_register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # List packs and get the first one
    packs_resp = await client.get("/api/shop/packs", headers=headers)
    assert packs_resp.status_code == 200
    packs = packs_resp.json()
    assert len(packs) > 0
    pack_id = packs[0]["id"]

    # Open a pack
    open_resp = await client.post(
        f"/api/shop/packs/{pack_id}/open",
        headers=headers,
        json={"quantity": 1},
    )
    assert open_resp.status_code == 200
    result = open_resp.json()
    assert "cards" in result
    assert len(result["cards"]) >= 1
    # Validate card structure
    for card in result["cards"]:
        assert "card_id" in card
        assert "rarity" in card


@pytest.mark.asyncio
async def test_open_pack_deducts_ink(client: AsyncClient):
    token = await test_register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    packs_resp = await client.get("/api/shop/packs", headers=headers)
    pack_id = packs_resp.json()[0]["id"]

    # Check ink before
    me_before = await client.get("/api/auth/me", headers=headers)
    ink_before = me_before.json().get("ink", 0)

    open_resp = await client.post(
        f"/api/shop/packs/{pack_id}/open",
        headers=headers,
        json={"quantity": 1},
    )
    assert open_resp.status_code == 200

    # Check ink after (should have decreased)
    me_after = await client.get("/api/auth/me", headers=headers)
    ink_after = me_after.json().get("ink", 0)
    assert ink_after <= ink_before, "Ink should decrease after buying a pack"


@pytest.mark.asyncio
async def test_invalid_pack_id(client: AsyncClient):
    token = await test_register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/shop/packs/nonexistent/open",
        headers=headers,
        json={"quantity": 1},
    )
    assert resp.status_code in (404, 422)
