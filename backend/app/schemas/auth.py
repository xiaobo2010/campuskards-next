import re
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator
from datetime import datetime


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_\u4e00-\u9fff]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    remember: bool = True

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("密码必须包含至少一个字母")
        if not re.search(r"\d", v):
            raise ValueError("密码必须包含至少一个数字")
        return v


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
    new_password: str = Field(min_length=8, max_length=128)
    reset_key: str = Field(min_length=1)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("密码必须包含至少一个字母")
        if not re.search(r"\d", v):
            raise ValueError("密码必须包含至少一个数字")
        return v


class UpdateProfileRequest(BaseModel):
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("密码必须包含至少一个字母")
        if not re.search(r"\d", v):
            raise ValueError("密码必须包含至少一个数字")
        return v
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
