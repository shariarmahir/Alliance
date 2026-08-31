"""cached CSE market snapshot for the admin Overview

CSE publishes no API, so the Overview's market panel scrapes its public
homepage. The numbers only move during trading hours and a scrape costs three
requests to someone else's server, so each index's snapshot is cached here and
refreshed on a timer rather than per page load.

The nested shapes stay JSON: nothing queries inside a snapshot, the panel
always reads the whole thing, and keeping them opaque means a change to what
CSE publishes needs no migration.

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
        sa.Column("index", sa.String(length=20), primary_key=True),
        sa.Column("value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("change", sa.Float(), nullable=False, server_default="0"),
        sa.Column("change_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("points", postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.Column("top", postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.Column("stats", postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("market_series")
