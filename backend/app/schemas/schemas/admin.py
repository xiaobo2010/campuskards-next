
from pydantic import BaseModel, Field


class AdminUserUpdate(BaseModel):
    ink: int | None = Field(default=None, ge=0)
    elo: int | None = Field(default=None, ge=0)
    role: str | None = Field(default=None, pattern=r"^(admin|player)$")


class CardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    name_en: str | None = Field(default=None, max_length=128)
    faction_code: str | None = Field(default=None, max_length=32)
    card_type: str | None = Field(default=None, max_length=32)
    unit_type: str | None = None
    cost: int | None = Field(default=None, ge=0)
    power: int | None = Field(default=None, ge=0)
    grit: int | None = Field(default=None, ge=0)
    spirit: int | None = Field(default=None, ge=0)
    effect_text: str | None = None
    effect_code: str | None = None
    rarity: str | None = Field(default=None, max_length=16)
    flavor_text: str | None = None
    artist: str | None = Field(default=None, max_length=128)
    image_url: str | None = None
    is_token: bool | None = None
    set_code: str | None = Field(default=None, max_length=16)


class SetCookieRequest(BaseModel):
    access_token: str
    refresh_token: str
    remember: bool = False


class ResetKeyUpdate(BaseModel):
    reset_key: str = Field(min_length=1, max_length=64)
