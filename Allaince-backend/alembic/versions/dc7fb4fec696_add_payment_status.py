"""add payment status to order confirmations

Payment is tracked separately from delivery: an order can be delivered
before payment clears, or paid for before it ships, so one field cannot
represent both.

Existing rows default to "pending" — the safe direction, since nothing
recorded whether they were paid, and treating an unpaid order as paid
would let a money receipt be issued for money never received.

Revision ID: dc7fb4fec696
Revises: 1d4b5d7b7ba6
Create Date: 2026-08-23 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'dc7fb4fec696'
down_revision: str | None = '1d4b5d7b7ba6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default fills existing rows in one statement; the column is then
    # NOT NULL without a second backfill pass.
    op.add_column(
        "order_confirmations",
        sa.Column(
            "payment_status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "order_confirmations",
        sa.Column("payment_received_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("order_confirmations", "payment_received_at")
    op.drop_column("order_confirmations", "payment_status")
