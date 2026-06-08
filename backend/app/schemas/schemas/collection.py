from uuid import UUID

from pydantic import BaseModel, field_serializer


class UserCardOut(BaseModel):
    card_id: str
    count: int

    model_config = {"from_attributes": True}
