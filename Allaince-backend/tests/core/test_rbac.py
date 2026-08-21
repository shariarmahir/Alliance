import pytest
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.deps import AdminDep, SuperAdminDep, owns_or_super, require_area
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.db import get_db
from app.main import app
from app.models import Employee
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
async def probe_client(engine):
    # Needs a database even though nothing here reads business data:
    # require_admin now checks the session against the revocation list and
    # re-checks the account behind it, both of which are queries.
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def sub_admin_row(engine):
    """The employee behind the SUB session below.

    require_admin re-checks that the account in a token still exists and is
    enabled, so a sub-admin session whose employee was never created now reads
    as a deleted account and gets 401 — correctly. These tests are about role
    rules, not deletion, so the row has to be real.
    """
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        session.add(
            Employee(
                id="emp-1",
                employee_id_number="emp-1",
                name="Bea",
                email="bea@x.com",
                password_hash="x",
                role="sub",
                access_options=[],
            )
        )
        await session.commit()


def _cookie(client, **kwargs):
    client.cookies.set(ADMIN_SESSION_COOKIE, create_session_token(AdminSession(**kwargs)))


SUPER = {"role": "super", "name": "Ada", "email": "ada@x.com"}
SUB = {"role": "sub", "name": "Bea", "email": "bea@x.com", "employee_id": "emp-1"}


async def test_no_session_is_401_on_every_tier(probe_client):
    for path in ("/__rbac/any", "/__rbac/super", "/__rbac/orders-area"):
        assert (await probe_client.get(path)).status_code == 401


async def test_sub_admin_passes_require_admin(probe_client, sub_admin_row):
    _cookie(probe_client, **SUB)
    assert (await probe_client.get("/__rbac/any")).status_code == 200


async def test_sub_admin_is_forbidden_from_super_only(probe_client, sub_admin_row):
    _cookie(probe_client, **SUB)
    # 403 not 401: authenticated, just not permitted.
    assert (await probe_client.get("/__rbac/super")).status_code == 403


async def test_super_admin_passes_super_only(probe_client):
    _cookie(probe_client, **SUPER)
    assert (await probe_client.get("/__rbac/super")).status_code == 200


async def test_area_requires_the_specific_grant(probe_client, sub_admin_row):
    _cookie(probe_client, **{**SUB, "access_options": ["quotations"]})
    assert (await probe_client.get("/__rbac/orders-area")).status_code == 403


async def test_area_passes_with_the_grant(probe_client, sub_admin_row):
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


async def test_session_for_a_missing_employee_is_rejected(probe_client):
    """A token naming an employee who no longer exists is not a valid session.

    This is the deleted-employee case: the row is gone, but the token they are
    still holding is signed and unexpired. Without the account re-check it
    kept working — reads and writes both — until it expired hours later.
    """
    _cookie(probe_client, **SUB)
    assert (await probe_client.get("/__rbac/any")).status_code == 401
