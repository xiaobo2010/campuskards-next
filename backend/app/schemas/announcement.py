from uuid import UUID

from datetime import datetime

from pydantic import BaseModel, field_serializer, Field


class AuthorOut(BaseModel):
    id: UUID
    username: str

    model_config = {"from_attributes": True}

    @field_serializer('id')
    def serialize_id(self, v: UUID) -> str:
        return str(v)


class AnnouncementOut(BaseModel):
    id: UUID
    title: str
    content: str
    category: str
    priority: str = "normal"
    is_pinned: bool = False
    author: AuthorOut | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer('id')
    def serialize_id(self, v: UUID) -> str:
        return str(v)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1)
    category: str = Field(default="general", max_length=32)
    priority: str = Field(default="normal", max_length=10)
    is_pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=128)
    content: str | None = Field(default=None, min_length=1)
    category: str | None = Field(default=None, max_length=32)
    priority: str | None = Field(default=None, max_length=10)
    is_pinned: bool | None = None
