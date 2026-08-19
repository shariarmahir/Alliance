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
