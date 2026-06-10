from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

MatchMode = Literal["quick", "ranked", "pve", "story"]


class MatchQueueRequest(BaseModel):
    deck_id: UUID
    mode: MatchMode = "quick"


class PveMatchRequest(BaseModel):
    deck_id: UUID


class OpponentInfo(BaseModel):
    id: str
    username: str
    elo: int


class PveMatchResponse(BaseModel):
    status: str = "matched"
    mode: MatchMode = "pve"
    match_id: str
    opponent: OpponentInfo


class MatchQueueResponse(BaseModel):
    status: str = "queued"
    mode: MatchMode = "quick"
    queue_position: int
    estimated_wait: int = Field(description="Estimated wait in milliseconds")
    match_id: str | None = None


class MatchQueueCancelResponse(BaseModel):
    status: str = "cancelled"


class MatchQueueStatusResponse(BaseModel):
    status: str  # queued | matched | idle
    mode: MatchMode | None = None
    match_id: str | None = None
    opponent: OpponentInfo | None = None
    queue_position: int | None = None
    estimated_wait: int | None = None


class MatchUserInfo(BaseModel):
    id: str
    username: str
    elo: int
    deck_id: str
    deck_faction: str | None = None


class MatchDetailResponse(BaseModel):
    id: str
    status: str  # active | finished
    mode: MatchMode = "quick"
    end_reason: str | None = None
    p1: MatchUserInfo
    p2: MatchUserInfo
    winner_id: str | None = None
    turns_played: int | None = None
    started_at: str | None = None
    ended_at: str | None = None
    replay_data: dict | None = None


class MatchHistoryItem(BaseModel):
    id: str
    mode: MatchMode = "quick"
    opponent: OpponentInfo
    result: str  # win | loss | draw
    my_elo_change: int = 0
    end_reason: str | None = None
    my_deck_faction: str | None = None
    opponent_deck_faction: str | None = None
    turns_played: int | None = None
    started_at: str | None = None
    ended_at: str | None = None


class EloTimelinePoint(BaseModel):
    match_id: str
    ended_at: str
    delta: int
    cumulative: int


class MatchStatsResponse(BaseModel):
    total_matches: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    ranked_matches: int
    quick_matches: int
    current_elo: int
    elo_delta_7d: int
    elo_timeline_7d: list[EloTimelinePoint]


class MatchSurrenderResponse(BaseModel):
    result: str
    elo_change: int


class EloChangePayload(BaseModel):
    p1: int
    p2: int
