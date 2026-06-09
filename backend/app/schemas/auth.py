from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_serializer
from datetime import datetime


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_\u4e00-\u9fff]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, pattern=r"^(?=.*[A-Za-z])(?=.*\d).+$")
    remember: bool = True


class LoginRequest(BaseModel):
    login: str = Field(description="用户名或邮箱")
    password: str
    remember: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class UserOut(BaseModel):
    id: UUID
    username: str
    email: str
    elo: int
    ink: int
    role: str = "player"
    avatar_url: str | None = None

    @field_serializer('id')
    def serialize_id(self, v: UUID) -> str:
        return str(v)

    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    username: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128, pattern=r"^(?=.*[A-Za-z])(?=.*\d).+$")
    reset_key: str = Field(min_length=1)


class UpdateProfileRequest(BaseModel):
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128, pattern=r"^(?=.*[A-Za-z])(?=.*\d).+$")
    email: EmailStr | None = None


class AdminUserOut(BaseModel):
    id: UUID
    username: str
    email: str
    elo: int
    ink: int
    role: str = "player"
    is_active: bool = True
    created_at: datetime | None = None

    @field_serializer('id')
    def serialize_id(self, v: UUID) -> str:
        return str(v)

    model_config = {"from_attributes": True}
