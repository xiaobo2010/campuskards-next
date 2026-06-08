from pydantic import BaseModel, Field


class OpenPackRequest(BaseModel):
    pack_type: str = Field(pattern=r"^(basic|faction|premium)$")
    faction_code: str | None = None


class PackCardItem(BaseModel):
    id: str
    name: str
    rarity: str
    faction_code: str
    image_url: str | None = None

    model_config = {"from_attributes": True}


class OpenPackResponse(BaseModel):
    cards: list[PackCardItem]
    ink_remaining: int
