import base64

import pytest

from app.config import settings
from app.core.rate_limit import reset_in_memory_buckets
from app.core.security import hash_password
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Employee
from app.schemas.session import AdminSession


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_in_memory_buckets()
    yield
    reset_in_memory_buckets()


@pytest.fixture
def bootstrap_admin(monkeypatch):
    hashed = hash_password("superpassword")
    monkeypatch.setattr(settings, "super_admin_email", "boss@autolink.com")
    monkeypatch.setattr(
        settings, "super_admin_password_hash_b64", base64.b64encode(hashed.encode()).decode()
    )
    monkeypatch.setattr(settings, "super_admin_name", "Nurul Islam")


async def test_login_with_bootstrap_super_admin(client, bootstrap_admin):
    r = await client.post(
        "/api/admin/login", json={"email": "boss@autolink.com", "password": "superpassword"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["session"]["role"] == "super"
    assert body["session"]["name"] == "Nurul Islam"
    assert body["redirectTo"] == "/admin"
    assert ADMIN_SESSION_COOKIE in r.cookies


async def test_login_is_case_insensitive_on_email(client, bootstrap_admin):
    r = await client.post(
        "/api/admin/login", json={"email": "  BOSS@AutoLink.com ", "password": "superpassword"}
    )
    assert r.status_code == 200


async def test_login_rejects_wrong_password(client, bootstrap_admin):
    r = await client.post(
        "/api/admin/login", json={"email": "boss@autolink.com", "password": "nope"}
    )
    assert r.status_code == 401
    assert ADMIN_SESSION_COOKIE not in r.cookies


async def test_login_rejects_unknown_email(client):
    r = await client.post("/api/admin/login", json={"email": "ghost@x.com", "password": "x"})
    assert r.status_code == 401


async def test_login_with_employee_account(client, db):
    db.add(
        Employee(
            id="emp-1", employee_id_number="EMP-1", name="Bea", email="bea@autolink.com",
            password_hash=hash_password("staffpassword"), designation="sales-associate",
            role="sub", access_options=["orders"],
        )
    )
    await db.commit()

    r = await client.post(
        "/api/admin/login", json={"email": "bea@autolink.com", "password": "staffpassword"}
    )
    assert r.status_code == 200
    session = r.json()["session"]
    assert session["role"] == "sub"
    assert session["employeeId"] == "emp-1"
    assert session["accessOptions"] == ["orders"]


async def test_disabled_employee_cannot_log_in(client, db):
    db.add(
        Employee(
            id="emp-2", employee_id_number="EMP-2", name="Gone", email="gone@autolink.com",
            password_hash=hash_password("staffpassword"), disabled=True,
        )
    )
    await db.commit()

    r = await client.post(
        "/api/admin/login", json={"email": "gone@autolink.com", "password": "staffpassword"}
    )
    assert r.status_code == 401


async def test_login_response_never_contains_password_hash(client, db):
    db.add(
        Employee(
            id="emp-3", employee_id_number="EMP-3", name="Cy", email="cy@autolink.com",
            password_hash=hash_password("staffpassword"),
        )
    )
    await db.commit()
    r = await client.post(
        "/api/admin/login", json={"email": "cy@autolink.com", "password": "staffpassword"}
    )
    assert "$2b$" not in r.text
    assert "password" not in r.text.lower()


async def test_me_requires_a_session(client):
    assert (await client.get("/api/admin/me")).status_code == 401


async def test_me_returns_the_session(client):
    token = create_session_token(AdminSession(role="super", name="Ada", email="ada@x.com"))
    client.cookies.set(ADMIN_SESSION_COOKIE, token)
    r = await client.get("/api/admin/me")
    assert r.status_code == 200
    assert r.json()["email"] == "ada@x.com"


async def test_me_rejects_a_forged_cookie(client):
    # The whole point of signing: a hand-written cookie must not grant access.
    client.cookies.set(ADMIN_SESSION_COOKIE, '{"role":"super","name":"M","email":"m@x.com"}')
    assert (await client.get("/api/admin/me")).status_code == 401


async def test_login_is_rate_limited(client, bootstrap_admin):
    for _ in range(10):
        await client.post(
            "/api/admin/login", json={"email": "boss@autolink.com", "password": "wrong"}
        )
    r = await client.post(
        "/api/admin/login", json={"email": "boss@autolink.com", "password": "superpassword"}
    )
    assert r.status_code == 429
    assert "Retry-After" in r.headers


# --- Session revocation -------------------------------------------------
#
# The session token is a stateless JWT, so nothing about signing out or being
# fired changes the token itself. These cover the two ways that used to leave a
# usable session behind.


async def test_logout_revokes_the_token_it_was_given(client, bootstrap_admin):
    login = await client.post(
        "/api/admin/login", json={"email": "boss@autolink.com", "password": "superpassword"}
    )
    token = login.cookies[ADMIN_SESSION_COOKIE]

    assert (await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: token})).status_code == 200

    await client.post("/api/admin/logout", cookies={ADMIN_SESSION_COOKIE: token})

    # The same token, presented again: the browser's cookie is irrelevant here,
    # which is the whole point — a captured copy must stop working too.
    after = await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: token})
    assert after.status_code == 401


async def test_logout_leaves_other_sessions_alone(client, bootstrap_admin):
    first = (
        await client.post(
            "/api/admin/login", json={"email": "boss@autolink.com", "password": "superpassword"}
        )
    ).cookies[ADMIN_SESSION_COOKIE]
    second = (
        await client.post(
            "/api/admin/login", json={"email": "boss@autolink.com", "password": "superpassword"}
        )
    ).cookies[ADMIN_SESSION_COOKIE]

    await client.post("/api/admin/logout", cookies={ADMIN_SESSION_COOKIE: first})

    assert (await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: first})).status_code == 401
    # Signing out of one device must not sign you out of the others.
    assert (
        await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: second})
    ).status_code == 200


async def test_logout_without_a_valid_cookie_still_succeeds(client):
    r = await client.post("/api/admin/logout", cookies={ADMIN_SESSION_COOKIE: "not-a-token"})
    assert r.status_code == 200


async def test_deleted_employee_token_stops_working(client, db, bootstrap_admin):
    employee = Employee(
        employee_id_number="emp-revoke",
        name="Revoke Test",
        email="revoke@autolink.com",
        password_hash=hash_password("testpass123"),
        role="sub",
        access_options=[],
    )
    db.add(employee)
    await db.commit()

    token = (
        await client.post(
            "/api/admin/login", json={"email": "revoke@autolink.com", "password": "testpass123"}
        )
    ).cookies[ADMIN_SESSION_COOKIE]
    assert (await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: token})).status_code == 200

    await db.delete(employee)
    await db.commit()

    # Firing someone has to take effect now, not whenever their token happens
    # to expire.
    assert (await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: token})).status_code == 401


async def test_disabled_employee_token_stops_working(client, db, bootstrap_admin):
    employee = Employee(
        employee_id_number="emp-disable",
        name="Disable Test",
        email="disable@autolink.com",
        password_hash=hash_password("testpass123"),
        role="sub",
        access_options=[],
    )
    db.add(employee)
    await db.commit()

    token = (
        await client.post(
            "/api/admin/login", json={"email": "disable@autolink.com", "password": "testpass123"}
        )
    ).cookies[ADMIN_SESSION_COOKIE]
    assert (await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: token})).status_code == 200

    employee.disabled = True
    await db.commit()

    assert (await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: token})).status_code == 401


async def test_token_without_a_session_id_is_rejected(client, bootstrap_admin):
    """Tokens minted before revocation existed carry no `sid`.

    They are precisely the ones that could be circulating from a logout that
    did not end the session, so they are not trusted.
    """
    legacy = create_session_token(
        AdminSession(role="super", name="Nurul Islam", email="boss@autolink.com")
    )
    # Strip the claim the way a pre-fix token would have been minted.
    import jwt

    payload = jwt.decode(legacy, settings.session_secret, algorithms=["HS256"])
    payload.pop("sid")
    stripped = jwt.encode(payload, settings.session_secret, algorithm="HS256")

    assert (
        await client.get("/api/admin/me", cookies={ADMIN_SESSION_COOKIE: stripped})
    ).status_code == 401
