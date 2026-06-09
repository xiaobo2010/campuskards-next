import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    elo: Mapped[int] = mapped_column(default=1000)
    ink: Mapped[int] = mapped_column(default=500)
    role: Mapped[str] = mapped_column(String(10), default="player", index=True)  # player|admin
    is_active: Mapped[bool] = mapped_column(default=True)
    reset_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    newbie_claimed: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    decks: Mapped[list["Deck"]] = relationship(back_populates="user")
    cards: Mapped[list["UserCard"]] = relationship(back_populates="user")
    announcements: Mapped[list["Announcement"]] = relationship(back_populates="author")

    @property
    def hq_bonus_hp(self) -> int:
        """ELO ≥ 2000: every 200 ELO above gives +1 HQ HP."""
        if self.elo < 2000:
            return 0
        return (self.elo - 2000) // 200


class Faction(Base):
    __tablename__ = "factions"

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(32))
    ability_name: Mapped[str] = mapped_column(String(64))
    ability_text: Mapped[str] = mapped_column(Text, default="")
    play_style: Mapped[str] = mapped_column(String(255), default="")
    icon_url: Mapped[str | None]
    color_primary: Mapped[str] = mapped_column(String(7), default="#6366f1")
    color_secondary: Mapped[str] = mapped_column(String(7), default="#818cf8")


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    name_en: Mapped[str] = mapped_column(String(64), default="")
    faction_code: Mapped[str] = mapped_column(ForeignKey("factions.code"))
    card_type: Mapped[str] = mapped_column(String(16))  # character / event / snitch
    unit_type: Mapped[str | None] = mapped_column(String(20))  # rep/jock/grind_lord/disciplinarian/gossip_squad
    cost: Mapped[int] = mapped_column()
    power: Mapped[int | None]
    grit: Mapped[int | None]
    spirit: Mapped[int | None]
    effect_text: Mapped[str] = mapped_column(Text, default="")
    effect_code: Mapped[str] = mapped_column(String(64), default="")
    rarity: Mapped[str] = mapped_column(String(16), default="common")
    flavor_text: Mapped[str] = mapped_column(Text, default="")
    artist: Mapped[str] = mapped_column(String(64), default="")
    image_url: Mapped[str | None]
    is_token: Mapped[bool] = mapped_column(default=False)
    set_code: Mapped[str] = mapped_column(String(8), default="S1")


class UserCard(Base):
    __tablename__ = "user_cards"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("cards.id"), primary_key=True)
    count: Mapped[int] = mapped_column(default=1)
    level: Mapped[int] = mapped_column(default=1, server_default="1")
    fragments: Mapped[int] = mapped_column(default=0, server_default="0")

    user: Mapped["User"] = relationship(back_populates="cards")
    card: Mapped["Card"] = relationship()


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(64))
    faction_code: Mapped[str] = mapped_column(ForeignKey("factions.code"))
    ally_faction_code: Mapped[str | None] = mapped_column(String(32))
    is_default: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="decks")
    entries: Mapped[list["DeckCard"]] = relationship(back_populates="deck", cascade="all, delete-orphan")


class DeckCard(Base):
    __tablename__ = "deck_cards"

    deck_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("decks.id"), primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("cards.id"), primary_key=True)
    quantity: Mapped[int] = mapped_column()

    deck: Mapped["Deck"] = relationship(back_populates="entries")
    card: Mapped["Card"] = relationship(lazy="selectin")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    p1_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    p2_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    winner_id: Mapped[uuid.UUID | None]
    p1_deck_id: Mapped[uuid.UUID]
    p2_deck_id: Mapped[uuid.UUID]
    mode: Mapped[str] = mapped_column(String(16), default="quick")  # quick | ranked
    end_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    replay_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    ended_at: Mapped[datetime | None]
    turns_played: Mapped[int | None]


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(128))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), default="general")  # update|event|maintenance|general
    priority: Mapped[str] = mapped_column(String(10), default="normal")   # low|normal|high|urgent
    is_pinned: Mapped[bool] = mapped_column(default=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    author: Mapped["User"] = relationship(back_populates="announcements")
