import logging
from pathlib import Path
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

logger = logging.getLogger(__name__)

from app.api.admin import router as admin_router
from app.api.announcements import router as announcements_router
from app.api.auth import router as auth_router
from app.api.cards import router as cards_router
from app.api.collection import router as collection_router
from app.api.decks import router as decks_router
from app.api.checkin import router as checkin_router
from app.api.shop import router as shop_router
from app.api.user import router as user_router
from app.api.leaderboard import router as leaderboard_router
from app.api.match import router as match_router
from app.ws.game import ws_router
from app.core.cache import close_redis, get_redis
from app.core.config import settings
from app.services.game_manager import game_manager


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # ── 启动：验证数据库 ──
    from app.core.database import engine

    try:
        async with engine.connect() as conn:
            await conn.execute(select(1))
            logger.info("Database connected")
    except Exception as exc:
        logger.warning("Database not reachable on startup: %s", exc)

    await game_manager.start()
    yield
    # ── 关闭：释放连接池 ──
    await game_manager.stop()
    await engine.dispose()
    await close_redis()
    logger.info("Backend shutdown complete")


app = FastAPI(
    title="CampusKards API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cards_router)
app.include_router(decks_router)
app.include_router(announcements_router)
app.include_router(admin_router)
app.include_router(collection_router)
app.include_router(shop_router)
app.include_router(checkin_router)
app.include_router(user_router)
app.include_router(leaderboard_router)
app.include_router(match_router)
app.include_router(ws_router)

# Mount uploads directory for serving avatar images
uploads_path = Path(__file__).parent / "uploads"
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"},
    )


@app.get("/api/health")
async def health_check():
    from app.core.database import async_session

    db_ok = False
    redis_ok = False

    try:
        async with async_session() as s:
            await s.execute(select(1))
            db_ok = True
    except Exception:
        pass

    client = await get_redis()
    if client:
        try:
            redis_ok = await client.ping()
        except Exception:
            redis_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "redis": "ok" if redis_ok else "unavailable",
    }
