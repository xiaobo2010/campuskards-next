from pydantic import BaseModel
from typing import Generic, TypeVar

from app.schemas.auth import *  # noqa: F401 F403
from app.schemas.card import *  # noqa: F401 F403
from app.schemas.announcement import *  # noqa: F401 F403
from app.schemas.collection import *  # noqa: F401 F403
from app.schemas.admin import *  # noqa: F401 F403

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
