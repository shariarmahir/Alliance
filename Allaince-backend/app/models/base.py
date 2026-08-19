from datetime import datetime, timezone

from sqlalchemy import DateTime, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


class JSONVariant(TypeDecorator):
    """JSONB on Postgres, plain JSON elsewhere.

    Production runs Postgres and wants JSONB (indexable, binary-packed); the
    test suite runs SQLite, which has no JSONB. Declaring the variant once here
    keeps every model free of dialect conditionals.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


class UTCDateTime(TypeDecorator):
    """Timezone-aware datetimes that survive a SQLite round trip.

    SQLite drops tzinfo, which would make naive/aware comparisons blow up in
    analytics bucketing. Values go in as UTC and always come back aware.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
