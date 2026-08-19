import pytest
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient

from app.core.deps import AdminDep, SuperAdminDep, owns_or_super, require_area
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.main import app
from app.schemas.session import AdminSession

# A throwaway router exercising each tier, so RBAC is tested independently of
# whichever real endpoints happen to use it.
probe = APIRouter(prefix="/__rbac")


@probe.get("/any")
async def any_admin(session: AdminDep):
    return {"email": session.email}


@probe.get("/super")
async def super_only(session: SuperAdminDep):
    return {"email": session.email}


@probe.get("/orders-area")
async def orders_area(session: AdminSession = Depends(require_area("orders"))):
    return {"email": session.email}


app.include_router(probe)


@pytest.fixture
async def probe_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _cookie(client, **kwargs):
    client.cookies.set(ADMIN_SESSION_COOKIE, create_session_token(AdminSession(**kwargs)))


SUPER = {"role": "super", "name": "Ada", "email": "ada@x.com"}
SUB = {"role": "sub", "name": "Bea", "email": "bea@x.com", "employee_id": "emp-1"}


async def test_no_session_is_401_on_every_tier(probe_client):
    for path in ("/__rbac/any", "/__rbac/super", "/__rbac/orders-area"):
        assert (await probe_client.get(path)).status_code == 401


async def test_sub_admin_passes_require_admin(probe_client):
    _cookie(probe_client, **SUB)
    assert (await probe_client.get("/__rbac/any")).status_code == 200


async def test_sub_admin_is_forbidden_from_super_only(probe_client):
    _cookie(probe_client, **SUB)
    # 403 not 401: authenticated, just not permitted.
    assert (await probe_client.get("/__rbac/super")).status_code == 403


async def test_super_admin_passes_super_only(probe_client):
    _cookie(probe_client, **SUPER)
    assert (await probe_client.get("/__rbac/super")).status_code == 200


async def test_area_requires_the_specific_grant(probe_client):
    _cookie(probe_client, **{**SUB, "access_options": ["quotations"]})
    assert (await probe_client.get("/__rbac/orders-area")).status_code == 403


async def test_area_passes_with_the_grant(probe_client):
    _cookie(probe_client, **{**SUB, "access_options": ["orders"]})
    assert (await probe_client.get("/__rbac/orders-area")).status_code == 200


async def test_super_admin_bypasses_area_grants(probe_client):
    _cookie(probe_client, **SUPER)
    assert (await probe_client.get("/__rbac/orders-area")).status_code == 200


def test_ownership_check():
    super_session = AdminSession(**SUPER)
    sub_session = AdminSession(**SUB)
    assert owns_or_super(super_session, "someone-else")
    assert owns_or_super(sub_session, "emp-1")
    assert not owns_or_super(sub_session, "emp-2")
    # A session with no employee id owns nothing, even against a null owner.
    assert not owns_or_super(AdminSession(role="sub", name="X", email="x@x.com"), None)
