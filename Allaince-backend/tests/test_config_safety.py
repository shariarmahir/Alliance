import pytest

from app.config import settings
from app.main import _check_production_config


@pytest.fixture
def prod(monkeypatch):
    monkeypatch.setattr(settings, "cors_allowed_origins", "https://autolink.example")
    monkeypatch.setattr(settings, "cookie_secure", True)
    monkeypatch.setattr(settings, "cookie_samesite", "none")
    monkeypatch.setattr(settings, "database_url", "postgresql+asyncpg://u:p@h/db")


def test_safe_production_config_passes(prod):
    _check_production_config()


def test_wildcard_cors_is_rejected(prod, monkeypatch):
    monkeypatch.setattr(settings, "cors_allowed_origins", "*")
    with pytest.raises(RuntimeError, match="exact origins"):
        _check_production_config()


def test_insecure_cookie_is_rejected(prod, monkeypatch):
    monkeypatch.setattr(settings, "cookie_secure", False)
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        _check_production_config()


def test_sqlite_in_production_is_rejected(prod, monkeypatch):
    monkeypatch.setattr(settings, "database_url", "sqlite+aiosqlite:///./dev.db")
    with pytest.raises(RuntimeError, match="SQLite"):
        _check_production_config()


def test_all_problems_are_reported_together(prod, monkeypatch):
    monkeypatch.setattr(settings, "cors_allowed_origins", "*")
    monkeypatch.setattr(settings, "cookie_secure", False)
    with pytest.raises(RuntimeError) as exc:
        _check_production_config()
    assert "CORS_ALLOWED_ORIGINS" in str(exc.value)
    assert "COOKIE_SECURE" in str(exc.value)


def test_short_session_secret_is_rejected_at_load():
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError):
        Settings(
            session_secret="too-short",
            gmail_token_encryption_secret="test-secret-must-be-at-least-32-characters",
        )


def test_plaintext_origin_is_rejected(prod, monkeypatch):
    """An http:// origin in production defeats the secure cookie.

    COOKIE_SECURE means the browser only sends the session over HTTPS, so a
    plaintext origin in the allowlist is either dead configuration or a
    downgrade path. Either way it should not reach production silently.
    """
    monkeypatch.setattr(
        settings, "cors_allowed_origins", "https://auto-bd.com,http://auto-bd.com"
    )
    with pytest.raises(RuntimeError, match="https"):
        _check_production_config()


def test_localhost_origin_is_rejected(prod, monkeypatch):
    """A leftover dev origin lets a page on the developer's own machine call
    production with the admin's cookie attached. It is the easiest of these
    to leave behind, because it is what every .env starts with."""
    # https, so the plaintext rule cannot fire -- this isolates the localhost
    # check. With http:// both rules match and the test proves nothing about
    # which one caught it.
    monkeypatch.setattr(
        settings, "cors_allowed_origins", "https://auto-bd.com,https://localhost:3000"
    )
    with pytest.raises(RuntimeError, match="development origin"):
        _check_production_config()


def test_real_production_origins_still_pass(prod, monkeypatch):
    """The guard must not reject the configuration it is meant to allow."""
    monkeypatch.setattr(
        settings,
        "cors_allowed_origins",
        "https://www.auto-bd.com,https://auto-bd.com",
    )
    _check_production_config()
