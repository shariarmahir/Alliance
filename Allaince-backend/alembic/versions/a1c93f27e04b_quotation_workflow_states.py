"""Quotation workflow states and work-order fields

The client's workflow is inbox -> pending -> submitted -> confirmed, where
"pending" means a quotation has been prepared but not yet sent. The old scheme
used "pending" for an untouched request and "quoted" for a prepared one, so the
word "pending" means opposite things in the two schemes and a plain rename
would mislabel every live row.

The remap is:
  pending -> inbox     (untouched request)
  quoted  -> pending   (prepared, not yet sent)

Order matters. "pending" is both a source and a target name, so running
quoted->pending first would then have pending->inbox sweep those same rows
straight on to inbox. Renaming pending->inbox first empties the name before
anything is renamed into it.

Revision ID: a1c93f27e04b
Revises: dc7fb4fec696
"""

from alembic import op
import sqlalchemy as sa

revision = "a1c93f27e04b"
down_revision = "dc7fb4fec696"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("quoted_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quotations", sa.Column("po_document_url", sa.Text(), nullable=True))
    op.add_column(
        "quotations",
        sa.Column("po_number", sa.String(length=120), server_default="", nullable=False),
    )
    op.add_column("quotations", sa.Column("po_uploaded_at", sa.DateTime(timezone=True), nullable=True))

    # Untouched requests become "inbox" first, so the quoted->pending rename
    # below cannot pick them up again.
    op.execute("UPDATE quotations SET status = 'inbox' WHERE status = 'pending'")
    op.execute("UPDATE quotations SET status = 'pending' WHERE status = 'quoted'")

    # Anything already emailed is genuinely submitted; without a sent-at column
    # historically there is no way to distinguish, so this is left alone and
    # those rows sit in "pending" until the admin re-sends. Marking them
    # submitted would claim a send this database has no record of.


def downgrade() -> None:
    op.execute("UPDATE quotations SET status = 'quoted' WHERE status IN ('pending', 'submitted')")
    op.execute("UPDATE quotations SET status = 'pending' WHERE status = 'inbox'")

    op.drop_column("quotations", "po_uploaded_at")
    op.drop_column("quotations", "po_number")
    op.drop_column("quotations", "po_document_url")
    op.drop_column("quotations", "quoted_sent_at")
