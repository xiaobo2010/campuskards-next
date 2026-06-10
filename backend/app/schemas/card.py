from pydantic import BaseModel, field_serializer, Field
from datetime import datetime


# ─── Card schemas ───
class CardOut(BaseModel):
    id: str
    name: str
    name_en: str = ""
    faction_code: str = ""
    card_type: str = ""
    unit_type: str | None = None
    cost: int = 0
    power: int | None = None
    grit: int | None = None
    spirit: int | None = None
    effect_text: str = ""
    effect_code: str = ""
    rarity: str = "common"
    flavor_text: str = ""
    artist: str = ""
    image_url: str | None = None
    is_token: bool = False
    set_code: str = "S1"

    model_config = {"from_attributes": True}

    @field_serializer('id')
    def serialize_id(self, v) -> str:
        return str(v)


class CardListParams(BaseModel):
    faction: str | None = None
    card_type: str | None = None
    cost: int | None = None
    rarity: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=100, ge=1, le=500)


# ─── Deck schemas ───
class DeckCardIn(BaseModel):
    card_id: str
    quantity: int = Field(default=1, ge=1, le=3)


class DeckCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    faction_code: str = "key_class"
    ally_faction_code: str | None = None
    cards: list[DeckCardIn] = []


class DeckUpdate(BaseModel):
    name: str | None = None
    faction_code: str | None = None
    ally_faction_code: str | None = None
    cards: list[DeckCardIn] | None = None


class DeckCardOut(BaseModel):
    card_id: str
    quantity: int
    card: CardOut | None = None

    model_config = {"from_attributes": True}


class DeckOut(BaseModel):
    id: str
    user_id: str
    name: str
    faction_code: str
    ally_faction_code: str | None = None
    is_default: bool = False
    created_at: datetime | None = None
    entries: list[DeckCardOut] = []

    model_config = {"from_attributes": True}

    @field_serializer('id')
    def serialize_id(self, v) -> str:
        return str(v)


class DeckListOut(BaseModel):
    id: str
    name: str
    faction_code: str
    card_count: int = 0
    created_at: datetime | None = None
