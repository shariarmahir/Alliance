from app.core.session_token import create_session_token, parse_admin_session
from app.schemas.session import AdminSession


def test_round_trip_preserves_session_fields():
    session = AdminSession(role="super", name="Ada", email="ada@example.com")
    assert parse_admin_session(create_session_token(session)) == session


def test_round_trip_preserves_optional_fields():
    session = AdminSession(
        role="sub",
        name="Bea",
        email="bea@example.com",
        employee_id="emp-1",
        access_options=["orders", "quotations"],
    )
    assert parse_admin_session(create_session_token(session)) == session


def test_parse_returns_none_for_missing_token():
    assert parse_admin_session(None) is None


def test_parse_returns_none_for_garbage_token():
    assert parse_admin_session("not-a-real-jwt") is None


def test_parse_returns_none_for_tampered_token():
    token = create_session_token(AdminSession(role="super", name="Ada", email="ada@example.com"))
    assert parse_admin_session(token[:-4] + "abcd") is None


def test_parse_returns_none_for_expired_token():
    import jwt

    from app.config import settings

    expired = jwt.encode(
        {"role": "super", "name": "Ada", "email": "ada@example.com", "exp": 1_600_000_000},
        settings.session_secret,
        algorithm="HS256",
    )
    assert parse_admin_session(expired) is None


def test_parse_rejects_token_signed_with_wrong_secret():
    import jwt

    forged = jwt.encode(
        {"role": "super", "name": "Mallory", "email": "m@example.com", "exp": 4_102_444_800},
        "a-different-secret-that-is-long-enough-x",
        algorithm="HS256",
    )
    assert parse_admin_session(forged) is None


def test_parse_rejects_unsigned_alg_none_token():
    # The classic JWT downgrade: alg=none must never be accepted.
    import jwt

    forged = jwt.encode(
        {"role": "super", "name": "Mallory", "email": "m@example.com", "exp": 4_102_444_800},
        key="",
        algorithm="none",
    )
    assert parse_admin_session(forged) is None


def test_parse_returns_none_for_invalid_role():
    import jwt

    from app.config import settings

    bad = jwt.encode(
        {"role": "root", "name": "Ada", "email": "a@e.com", "exp": 4_102_444_800},
        settings.session_secret,
        algorithm="HS256",
    )
    assert parse_admin_session(bad) is None
