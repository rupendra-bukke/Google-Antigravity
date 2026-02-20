"""Application settings — loaded from .env via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "NIFTY 50 Stock Intelligence"
    debug: bool = False
    cors_origins: list[str] = ["*"]
    default_symbol: str = "^NSEI"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
