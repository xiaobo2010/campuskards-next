from pydantic import BaseModel, Field

FRAGMENT_VALUES: dict[str, int] = {"common": 1, "uncommon": 2, "rare": 4, "epic": 8, "legendary": 8}


class PackOut(BaseModel):
    id: str
    name: str
    description: str
    price_ink: int
    cards_count: int
    cost_type: str = "ink"
    price_elo: int = 0
    min_elo: int = 0
    faction_code: str | None = None


class OpenPackRequest(BaseModel):
    pack_type: str = Field(
        pattern=r"^(basic|advanced|selector|faction|prestige|premium)$"
    )
    faction_code: str | None = None


class PackCardItem(BaseModel):
    card_id: str
    name: str
    rarity: str
    faction_code: str = ""
    is_new: bool
    slot_index: int | None = None
    count: int = 1

    model_config = {"from_attributes": True}


class OpenPackResponse(BaseModel):
    pack_id: str = ""
    cards: list[PackCardItem]
    new: list[str] = Field(default_factory=list)
    fragments: dict[str, int] = Field(default_factory=dict)
    remaining_ink: int = 0
    remaining_elo: int | None = None
    can_reroll: bool = False
    reroll_token: str | None = None


class SelectorFinalizeRequest(BaseModel):
    reroll_token: str


class SelectorRerollRequest(BaseModel):
    reroll_token: str
    slot_index: int = Field(ge=0)
