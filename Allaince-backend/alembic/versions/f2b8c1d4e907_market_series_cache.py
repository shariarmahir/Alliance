"""cached weekly share prices for the manufacturers this business trades

The provider's free tier allows five requests a minute. Fetching per request
would exhaust that on one Overview reload, so each ticker's weekly series is
cached here and refreshed at most once every settings.market_cache_hours.

`bars` keeps the provider's aggregates verbatim as JSON rather than exploding
them into rows: nothing queries an individual week, the panel always reads the
whole series, and storing the raw shape means a different chart later needs no
migration and no refetch.

Revision ID: f2b8c1d4e907
Revises: e5a71c3b9f28
Create Date: 2026-08-31 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f2b8c1d4e907'
down_revision: str | None = 'e5a71c3b9f28'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "market_series",
        sa.Column("ticker", sa.String(length=20), primary_key=True),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column(
            "bars",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=False,
        ),
        sa.Column("latest_close", sa.Float(), nullable=False, server_default="0"),
        sa.Column("change_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("week_volume", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("market_series")
