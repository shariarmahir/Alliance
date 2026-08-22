"""remove viewed quotation status

"viewed" was a triage state between pending and confirmed. It is being
removed from the admin dashboard entirely (button, filter tab, and the
schema's allowed values), so any quotation still sitting at "viewed" would
otherwise fail to serialize once the Pydantic Literal drops it. Existing
"viewed" rows go back to "pending" — they were never priced, so pending is
where they belong; nothing about the request itself is lost.

Revision ID: 8094350f9bb4
Revises: c7d2e4a81b93
Create Date: 2026-08-23 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '8094350f9bb4'
down_revision: str | None = 'c7d2e4a81b93'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE quotations SET status = 'pending' WHERE status = 'viewed'"))


def downgrade() -> None:
    # Not reversible: once merged into "pending" a viewed row is
    # indistinguishable from one that was never opened.
    pass
