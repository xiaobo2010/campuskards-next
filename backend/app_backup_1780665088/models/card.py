from sqlalchemy import Column, String, Integer, Text, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base

# Deck-Card association table
deck_cards = Table(
    "deck_cards",
    Base.metadata,
    Column("deck_id", UUID(as_uuid=True), ForeignKey("decks.id", ondelete="CASCADE"), primary_key=True),
    Column("card_id", String(64), ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("quantity", Integer, nullable=False, default=1),
)


class Card(Base):
    __tablename__ = "cards"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False, index=True)
    faction = Column(String(32), nullable=False, index=True)
    type = Column(String(32), nullable=False, index=True)
    subtype = Column(String(32), nullable=True)
    cost = Column(Integer, nullable=False, default=0, index=True)
    attack = Column(Integer, nullable=True)
    defense = Column(Integer, nullable=True)
    hp = Column(Integer, nullable=True)
    ability = Column(Text, nullable=True)
    rarity = Column(String(16), nullable=False, default="common", index=True)
    flavor = Column(Text, nullable=True)


class Deck(Base):
    __tablename__ = "decks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    faction = Column(String(32), nullable=False, default="key_class")
    cards = relationship("Card", secondary=deck_cards, backref="decks", lazy="selectin")
    card_quantities = Column(JSON, default=dict, nullable=True)  # {"card_id": quantity} for quick access
