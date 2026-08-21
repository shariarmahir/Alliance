from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, utcnow


class RevokedSession(Base):
    """Session IDs that must no longer be honoured.

    The session token is a stateless JWT, which is what made logout a lie: the
    server kept no record of it, so "signing out" only cleared the browser's
    cookie jar while the token itself stayed valid for its full 8 hours.
    Anyone holding a copy — a shared machine, a captured cookie — kept working
    admin access. Deleting an employee had the same hole: the row went, the
    token did not.

    A denylist rather than a session table because it stays small and is only
    consulted, never written, on the hot path: rows exist solely for sessions
    cut short, and expire on their own once the underlying token could no
    longer have been accepted anyway.
    """

    __tablename__ = "revoked_sessions"

    # The token's `sid` claim, not the employee — one row per signed-out
    # session, so revoking one device leaves that person's others alone.
    session_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    # When the underlying token expires. Past this instant the row is dead
    # weight: the JWT fails its own expiry check without any help from here.
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True, nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
