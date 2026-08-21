"""revoked sessions

Session tokens are stateless JWTs, so signing out cleared only the browser's
cookie and left the token itself usable until it expired. This table is the
denylist that makes logout actually end a session.

Revision ID: b3f1a7c92d40
Revises: 26681b25eb53
Create Date: 2026-08-22 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import app.models.base


revision: str = 'b3f1a7c92d40'
down_revision: str | None = '26681b25eb53'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'revoked_sessions',
        sa.Column('session_id', sa.String(length=36), nullable=False),
        sa.Column('expires_at', app.models.base.UTCDateTime(), nullable=False),
        sa.Column('revoked_at', app.models.base.UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint('session_id'),
    )
    # Only ever queried as a range scan by the expiry purge.
    op.create_index(
        op.f('ix_revoked_sessions_expires_at'), 'revoked_sessions', ['expires_at'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_revoked_sessions_expires_at'), table_name='revoked_sessions')
    op.drop_table('revoked_sessions')
