from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from the environment — no secrets in source."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: Literal["development", "production", "test"] = "development"

    database_url: str = "sqlite+aiosqlite:///./dev.db"

    # Signing key for session JWTs. Short/missing keys are rejected outright:
    # a predictable signing key is the same vulnerability as no signing.
    session_secret: str = Field(min_length=32)
    gmail_token_encryption_secret: str = Field(min_length=32)

    cors_allowed_origins: str = "http://localhost:3000"

    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str | None = None

    super_admin_email: str | None = None
    super_admin_password_hash_b64: str | None = None
    super_admin_name: str = "Super Admin"

    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str | None = None

    resend_api_key: str | None = None
    resend_from_email: str = "info@auto-bd.com"
    notify_internal_email: str = "info@auto-bd.com"

    # Massive (formerly Polygon.io) — weekly share prices for the automation
    # manufacturers whose parts this business trades. Absent means the market
    # panels render their empty state rather than the API failing at runtime.
    #
    # The free tier allows 5 requests/minute, which is why market_cache_hours
    # exists: one refresh a day across a handful of tickers stays well inside
    # it, and the Overview reads the cached rows rather than the API.
    massive_api_key: str | None = None
    massive_base_url: str = "https://api.massive.com"
    market_cache_hours: int = 24

    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_region: str = "auto"
    s3_bucket_name: str = "allaince-images"
    s3_public_base_url: str | None = None

    redis_url: str | None = None

    public_api_url: str = "http://localhost:8000"
    public_site_url: str = "http://localhost:3000"

    @field_validator("cookie_domain", "s3_endpoint_url", "redis_url", "s3_public_base_url", mode="before")
    @classmethod
    def _empty_string_is_none(cls, value: object) -> object:
        # Env files commonly carry `KEY=` for "unset"; treat that as None so
        # optional integrations stay cleanly disabled rather than half-configured.
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def gmail_configured(self) -> bool:
        return bool(
            self.google_oauth_client_id
            and self.google_oauth_client_secret
            and self.google_oauth_redirect_uri
        )

    @property
    def s3_configured(self) -> bool:
        return bool(self.s3_access_key_id and self.s3_secret_access_key and self.s3_bucket_name)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
