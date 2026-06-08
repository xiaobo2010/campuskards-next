from pathlib import Path
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "campuskards"}
