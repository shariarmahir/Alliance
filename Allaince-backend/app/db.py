from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base

# SQLite (tests/dev) rejects the pool tuning that Postgres wants, so only pass
# pool options on a real server-backed URL.
_engine_kwargs: dict = {"echo": False, "future": True}
if not settings.database_url.startswith("sqlite"):
    _engine_kwargs |= {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True, "pool_recycle": 1800}

engine = create_async_engine(settings.database_url, **_engine_kwargs)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one session per request, rolled back on error."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_models() -> None:
    """Create tables directly. Used by tests and dev bootstrap only —
    production schema changes go through Alembic."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
