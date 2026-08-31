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

    # The shared mailbox, read over IMAP. Used for hosts that offer no OAuth
    # -- Namecheap Private Email (mail.privateemail.com), cPanel, and most
    # domain mail -- where the alternative is the account password.
    #
    # That password is why this is environment-only and never a field in the
    # admin UI: it grants full access to the mailbox, so it belongs with the
    # server's other secrets rather than travelling through a browser or
    # sitting in the database. It is never returned by any endpoint.
    imap_host: str | None = None
    imap_port: int = 993
    imap_username: str | None = None
    imap_password: str | None = None

    resend_api_key: str | None = None
    resend_from_email: str = "info@auto-bd.com"
    notify_internal_email: str = "info@auto-bd.com"

    # How long a scraped CSE snapshot is served before it is refetched. The
    # market panel reads the cache, so this is the only thing deciding how
    # often this app touches CSE's servers: short enough to stay current
    # through a trading session, long enough that a busy Overview does not
    # turn into a scraper hammering someone else's site.
    market_cache_minutes: int = 15

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
    def imap_configured(self) -> bool:
        return bool(self.imap_host and self.imap_username and self.imap_password)

    @property
    def mailbox_provider(self) -> str:
        """Which mailbox backend the Shared inbox screen should use.

        IMAP wins when both are set: it is configured with an explicit
        host and password, which is a deliberate act, where leftover Google
        OAuth credentials may simply be from a previous setup.
        """
        if self.imap_configured:
            return "imap"
        if self.gmail_configured:
            return "gmail"
        return "none"

    @property
    def s3_configured(self) -> bool:
        return bool(self.s3_access_key_id and self.s3_secret_access_key and self.s3_bucket_name)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
