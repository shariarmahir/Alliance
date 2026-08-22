"""collapse delivery stages to two

The four-stage delivery pipeline (Confirmed/Packed/In Transit/Delivered) was
never tracked against reality — freight is arranged directly with the
customer — so it is replaced by two states: 0 Pending, 1 Confirmed.

Any stored stage above 1 would otherwise clamp to Confirmed on read, showing
an order as confirmed without the customer ever having been emailed. Rows are
reset to Pending instead, so an admin makes that call deliberately and the
confirmation email actually goes out.

Revision ID: 1d4b5d7b7ba6
Revises: 8094350f9bb4
Create Date: 2026-08-23 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '1d4b5d7b7ba6'
down_revision: str | None = '8094350f9bb4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE order_confirmations SET delivery_stage = 0 WHERE delivery_stage > 1")
    )


def downgrade() -> None:
    # Not reversible: the original stage was discarded, and the old
    # intermediate stages no longer have a meaning to restore them to.
    pass
