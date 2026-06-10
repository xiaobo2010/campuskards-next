import asyncio
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text as sa_text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.types import JSON

from app.core.config import settings
from app.main import app
from app.models import Base
from sqlalchemy.sql.elements import TextClause

# 测试用 SQLite 内存库
TEST_DB_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(Base.metadata, "before_create")
def _jsonb_to_json_for_sqlite(target, connection, **kw):
    """Replace PostgreSQL JSONB columns and ::jsonb defaults with plain JSON when using SQLite."""
    if connection.engine.dialect.name == "postgresql":
        return
    for table in target.tables.values():
        for column in table.columns:
            if isinstance(column.type, JSONB):
                column.type = JSON()
                # Replace PostgreSQL-specific ::jsonb defaults with SQLite-compatible JSON defaults
                if column.server_default is not None and isinstance(column.server_default.arg, TextClause):
                    raw = str(column.server_default.arg).replace("::jsonb", "")
                    column.server_default = sa_text(raw)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    async with TestSession() as session:
        yield session


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
