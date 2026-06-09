import warnings

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://ck:changeme@localhost:5432/campuskards",
        description="PostgreSQL connection string. Override via .env or DATABASE_URL env var.",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection string. Override via .env or REDIS_URL env var.",
    )
    SECRET_KEY: str = Field(
        default="change-me-to-random-hex-32-chars",
        description="JWT signing key. Generate a random 32-char hex string for production.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def model_post_init(self, __context) -> None:
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY == "change-me-to-random-hex-32-chars":
                warnings.warn(
                    "SECRET_KEY is still the default value! Generate a random 32-char hex string for production.",
                    RuntimeWarning,
                    stacklevel=1,
                )
            if "changeme" in self.DATABASE_URL:
                warnings.warn(
                    "DATABASE_URL still has the default password placeholder! "
                    "Set a strong password in production.",
                    RuntimeWarning,
                    stacklevel=1,
                )


settings = Settings()
