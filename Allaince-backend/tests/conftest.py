import os

# Set TEST_DATABASE_URL to run the whole suite against a real PostgreSQL, e.g.
#   TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/allaince_test
# Unset, the suite uses in-memory SQLite so it runs anywhere with no services.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

# Must be set before app.config is imported anywhere.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL or "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "test-secret-must-be-at-least-32-characters")
os.environ.setdefault("GMAIL_TOKEN_ENCRYPTION_SECRET", "test-secret-must-be-at-least-32-characters")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

# The suite must never send real mail. Settings falls back to .env for
# anything unset, so on a developer machine with working credentials every
# test that triggers a notification was posting to Resend for real -- burning
# the account's daily quota and making the tests depend on someone else's
# service being up. Forced (not setdefault) so a key exported in the shell
# cannot reintroduce it.
os.environ["RESEND_API_KEY"] = ""
# Same reasoning for the mailbox: no test should reach a live IMAP server.
os.environ["IMAP_HOST"] = ""
os.environ["IMAP_USERNAME"] = ""
os.environ["IMAP_PASSWORD"] = ""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.db import get_db
from app.main import app
from app.models.base import Base


@pytest_asyncio.fixture
async def engine():
    if TEST_DATABASE_URL:
        # NullPool: each test drops and recreates the schema, and a pooled
        # connection holding the old tables would deadlock against the DDL.
        test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        yield test_engine
        await test_engine.dispose()
        return

    # StaticPool keeps every connection pointed at the same in-memory database;
    # without it each connection gets a private, empty one.
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignores foreign keys unless asked. Without this, ON DELETE SET NULL
    # silently does nothing and the tests would not reflect Postgres.
    @event.listens_for(test_engine.sync_engine, "connect")
    def _enable_fk(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncSession:
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(engine):
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
