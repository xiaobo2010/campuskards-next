from pydantic import BaseModel

from app.schemas.card import CardOut


class UserCardOut(BaseModel):
    """User's owned card with full card details."""
    card_id: str
    count: int
    level: int = 1
    fragments: int = 0
    card: CardOut | None = None

    model_config = {"from_attributes": True}
