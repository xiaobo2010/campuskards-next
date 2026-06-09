from datetime import date

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import checkin as checkin_api
from app.api.collection import AddCollectionRequest, add_to_collection
from app.core.security import create_access_token, hash_password
from app.models import Card, User, UserCard
from app.ws.game import _authenticate_ws


@pytest.mark.asyncio
async def test_ws_auth_rejects_revoked_and_inactive_tokens(db: AsyncSession):
    user = User(
        username="wsuser",
        email="wsuser@example.com",
        password_hash=hash_password("password123"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), token_version=user.token_version)
    assert await _authenticate_ws(token, db) == str(user.id)

    user.token_version += 1
    await db.commit()
    assert await _authenticate_ws(token, db) is None

    inactive_token = create_access_token(str(user.id), token_version=user.token_version)
    user.is_active = False
    await db.commit()
    assert await _authenticate_ws(inactive_token, db) is None


@pytest.mark.asyncio
async def test_checkin_conflict_does_not_award_duplicate_ink(db: AsyncSession):
    user = User(
        username="checkin",
        email="checkin@example.com",
        password_hash=hash_password("password123"),
        ink=500,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    checkin_api._table_ready = False
    await db.execute(text("DROP TABLE IF EXISTS user_checkins"))
    await db.commit()
    await checkin_api._ensure_checkins_table(db)

    today = date.today()
    first_inserted = await checkin_api._insert_checkin_and_award(db, user, today, 1, 200)
    await db.commit()
    assert first_inserted is True

    second_inserted = await checkin_api._insert_checkin_and_award(db, user, today, 1, 200)
    await db.commit()
    assert second_inserted is False

    await db.refresh(user)
    assert user.ink == 700


@pytest.mark.asyncio
async def test_admin_adds_new_card_to_collection_without_crashing(db: AsyncSession):
    admin = User(
        username="admin",
        email="admin@example.com",
        password_hash=hash_password("password123"),
        role="admin",
    )
    card = Card(
        id="critical-card",
        name="Critical Card",
        faction_code="key_class",
        card_type="character",
        cost=1,
        power=1,
        grit=1,
        spirit=1,
        rarity="common",
        is_token=False,
    )
    db.add_all([admin, card])
    await db.commit()
    await db.refresh(admin)

    response = await add_to_collection(
        card.id,
        AddCollectionRequest(count=2),
        _admin=admin,
        db=db,
    )
    assert response == {"card_id": card.id, "added": 2}

    result = await db.execute(
        select(UserCard).where(UserCard.user_id == admin.id, UserCard.card_id == card.id)
    )
    user_card = result.scalar_one()
    assert user_card.count == 2
