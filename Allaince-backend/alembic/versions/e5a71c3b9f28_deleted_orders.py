"""audit stub for purged orders

"Remove anyway" destroys a quotation and every invoice, challan, line and
receipt against it. Money recorded as received really was received, so a
stub outlives the deletion and keeps the figures the deleted-revenue chart
is drawn from.

No foreign key to quotations: the row it describes is gone by design, and a
reference to a deleted row is exactly what this table must not hold.

Revision ID: e5a71c3b9f28
Revises: a8c7bdab8852
Create Date: 2026-08-27 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'e5a71c3b9f28'
down_revision: str | None = 'a8c7bdab8852'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deleted_orders",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("quotation_id", sa.String(length=36), nullable=False),
        sa.Column("ref_number", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("customer_name", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("customer_email", sa.String(length=320), nullable=False, server_default=""),
        sa.Column("company_name", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("grand_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("amount_invoiced", sa.Float(), nullable=False, server_default="0"),
        sa.Column("amount_received", sa.Float(), nullable=False, server_default="0"),
        sa.Column("invoice_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("challan_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_by", sa.String(length=320), nullable=False, server_default=""),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
    )
    op.create_index("ix_deleted_orders_quotation_id", "deleted_orders", ["quotation_id"])
    op.create_index("ix_deleted_orders_ref_number", "deleted_orders", ["ref_number"])
    op.create_index("ix_deleted_orders_customer_email", "deleted_orders", ["customer_email"])
    op.create_index("ix_deleted_orders_deleted_at", "deleted_orders", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_deleted_orders_deleted_at", table_name="deleted_orders")
    op.drop_index("ix_deleted_orders_customer_email", table_name="deleted_orders")
    op.drop_index("ix_deleted_orders_ref_number", table_name="deleted_orders")
    op.drop_index("ix_deleted_orders_quotation_id", table_name="deleted_orders")
    op.drop_table("deleted_orders")
