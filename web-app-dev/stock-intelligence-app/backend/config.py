"""Application settings loaded from environment variables and .env."""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "NIFTY 50 Stock Intelligence"
    debug: bool = False
    cors_origins: list[str] = ["*"]
    default_symbol: str = "^NSEI"
    gemini_api_key: str = ""  # Set GEMINI_API_KEY on Render

    # Environment: "development" | "production"
    # Set APP_ENV=development on the Render dev service.
    # Prod service leaves this unset and defaults to "production".
    app_env: str = "production"

    # Release metadata shown in API/UI for easier dev vs prod validation.
    app_version: str = Field(
        default="v0.0.0",
        validation_alias=AliasChoices("APP_VERSION", "NEXT_PUBLIC_APP_VERSION"),
    )
    app_channel: str = Field(
        default="",
        validation_alias=AliasChoices("APP_CHANNEL"),
    )
    git_commit_sha: str = Field(
        default="",
        validation_alias=AliasChoices(
            "GIT_COMMIT_SHA",
            "VERCEL_GIT_COMMIT_SHA",
            "RENDER_GIT_COMMIT",
        ),
    )
    git_branch: str = Field(
        default="",
        validation_alias=AliasChoices(
            "GIT_BRANCH",
            "VERCEL_GIT_COMMIT_REF",
            "RENDER_GIT_BRANCH",
        ),
    )
    checkpoint_cron_secret: str = Field(
        default="",
        validation_alias=AliasChoices(
            "CHECKPOINT_CRON_SECRET",
            "SCHEDULER_SECRET",
        ),
    )

    supabase_url: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_URL",
        ),
    )
    supabase_publishable_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SUPABASE_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        ),
    )
    auth_required: bool = Field(
        default=True,
        validation_alias=AliasChoices("AUTH_REQUIRED"),
    )

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"

    @property
    def release_channel(self) -> str:
        channel = self.app_channel.strip().lower()
        if channel:
            return channel
        return "dev" if self.is_dev else "prod"

    @property
    def short_commit(self) -> str:
        sha = (self.git_commit_sha or "").strip()
        return sha[:7] if sha else "local"

    @property
    def build_label(self) -> str:
        return f"{self.release_channel}-{self.app_version}-{self.short_commit}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
