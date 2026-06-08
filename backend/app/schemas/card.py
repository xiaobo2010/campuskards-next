from pydantic import BaseModel, field_serializer, Field, model_validator
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

    model_config = {"from_attributes": True, "populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def map_legacy_fields(cls, data):
        """Map old DB column names to new schema field names.
        
        DB columns:  faction, type, attack, defense, hp, ability, flavor, subtype
        Schema expects: faction_code, card_type, power, grit, spirit, effect_text, flavor_text, unit_type
        """
        if not isinstance(data, dict):
            # It's a SQLAlchemy model object — access attributes
            # Use getattr with defaults to handle both old and new column names
            mapping = {
                "faction_code": ("faction_code", "faction"),
                "card_type": ("card_type", "type"),
                "power": ("power", "attack"),
                "grit": ("grit", "defense"),
                "spirit": ("spirit", "hp"),
                "effect_text": ("effect_text", "ability"),
                "flavor_text": ("flavor_text", "flavor"),
                "unit_type": ("unit_type", "subtype"),
                "name_en": ("name_en",),
                "effect_code": ("effect_code",),
                "artist": ("artist",),
                "image_url": ("image_url",),
                "is_token": ("is_token",),
                "set_code": ("set_code",),
            }
            result = {}
            for schema_field, db_fields in mapping.items():
                for db_field in db_fields:
                    val = getattr(data, db_field, None)
                    if val is not None:
                        result[schema_field] = val
                        break
            
            # Required fields
            result["id"] = getattr(data, "id")
            result["name"] = getattr(data, "name")
            result["cost"] = getattr(data, "cost", 0)
            result["rarity"] = getattr(data, "rarity", "common")
            return result
        
        # Dict input — map legacy keys
        key_map = {
            "faction": "faction_code",
            "type": "card_type",
            "attack": "power",
            "defense": "grit",
            "hp": "spirit",
            "ability": "effect_text",
            "flavor": "flavor_text",
            "subtype": "unit_type",
        }
        for old_key, new_key in key_map.items():
            if old_key in data and new_key not in data:
                data[new_key] = data[old_key]
        return data

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


# ─── Collection / UserCard schemas ───
class UserCardOut(BaseModel):
    """A card owned by a user."""
    card_id: str
    quantity: int = 1
    card: CardOut | None = None

    model_config = {"from_attributes": True}


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
