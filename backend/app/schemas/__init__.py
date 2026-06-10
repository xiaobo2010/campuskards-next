from pydantic import BaseModel
from typing import Generic, TypeVar

from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
    AdminUserOut,
)
from app.schemas.card import (
    CardOut,
    CardListParams,
    DeckCardIn,
    DeckCardOut,
    DeckCreate,
    DeckOut,
    DeckListOut,
    DeckUpdate,
    UpgradeCardOut,
)
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementOut,
    AnnouncementUpdate,
    AuthorOut,
)
from app.schemas.collection import UserCardOut
from app.schemas.admin import (
    SetCookieRequest,
    AdminUserUpdate,
    CardUpdate,
    ResetKeyUpdate,
    PinRequest,
)

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
