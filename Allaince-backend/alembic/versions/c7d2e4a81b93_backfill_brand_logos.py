"""backfill brand logos

Brands are created implicitly from product data and nothing ever set their
logo, so every row carried an empty string and the storefront rendered six
broken images. Point existing rows at the conventional asset path.

Revision ID: c7d2e4a81b93
Revises: b3f1a7c92d40
Create Date: 2026-08-22 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d2e4a81b93'
down_revision: str | None = 'b3f1a7c92d40'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Only rows that have no logo — never overwrite one somebody set
    # deliberately. The storefront falls back to a text wordmark when the file
    # turns out not to exist, so a path guessed for a brand without an asset is
    # harmless rather than a broken image.
    op.execute(
        sa.text(
            "UPDATE brands SET logo = '/images/brands/' || slug || '.png' "
            "WHERE logo IS NULL OR logo = ''"
        )
    )


def downgrade() -> None:
    # Restores the previous state exactly: these were all empty before.
    op.execute(
        sa.text(
            "UPDATE brands SET logo = '' "
            "WHERE logo = '/images/brands/' || slug || '.png'"
        )
    )
