"""Application settings — loaded from .env via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "NIFTY 50 Stock Intelligence"
    debug: bool = False
    cors_origins: list[str] = ["*"]
    default_symbol: str = "^NSEI"
    gemini_api_key: str = ""          # Set GEMINI_API_KEY on Render

    # Environment: "development" | "production"
    # Set APP_ENV=development on the Render dev service.
    # Prod service leaves this unset → defaults to "production".
    app_env: str = "production"

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
