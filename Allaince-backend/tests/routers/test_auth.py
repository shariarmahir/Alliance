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
