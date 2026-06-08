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
    name_en = Column(String(128), nullable=False, default="")
    faction_code = Column(String(32), nullable=False, index=True)
    card_type = Column(String(32), nullable=False, index=True)
    unit_type = Column(String(32), nullable=True)
    cost = Column(Integer, nullable=False, default=0, index=True)
    power = Column(Integer, nullable=True)
    grit = Column(Integer, nullable=True)
    spirit = Column(Integer, nullable=True)
    effect_text = Column(Text, nullable=True)
    effect_code = Column(String(128), nullable=True)
    rarity = Column(String(16), nullable=False, default="common", index=True)
    flavor_text = Column(Text, nullable=True)
    artist = Column(String(64), nullable=True)
    image_url = Column(String(512), nullable=True)
    is_token = Column(Integer, nullable=False, default=0)
    set_code = Column(String(16), nullable=False, default="S1")

    # Legacy aliases for backward compatibility
    @property
    def faction(self):
        return self.faction_code

    @faction.setter
    def faction(self, value):
        self.faction_code = value

    @property
    def type(self):
        return self.card_type

    @type.setter
    def type(self, value):
        self.card_type = value

    @property
    def attack(self):
        return self.power

    @attack.setter
    def attack(self, value):
        self.power = value

    @property
    def defense(self):
        return self.grit

    @defense.setter
    def defense(self, value):
        self.grit = value

    @property
    def hp(self):
        return self.spirit

    @hp.setter
    def hp(self, value):
        self.spirit = value

    @property
    def ability(self):
        return self.effect_text

    @ability.setter
    def ability(self, value):
        self.effect_text = value

    @property
    def flavor(self):
        return self.flavor_text

    @flavor.setter
    def flavor(self, value):
        self.flavor_text = value


class Deck(Base):
    __tablename__ = "decks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    faction_code = Column(String(32), nullable=False, default="key_class")
    cards = relationship("Card", secondary=deck_cards, backref="decks", lazy="selectin")
    card_quantities = Column(JSON, default=dict, nullable=True)  # {"card_id": quantity} for quick access
