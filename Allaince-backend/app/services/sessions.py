from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Employee, RevokedSession


async def revoke_session(db: AsyncSession, session_id: str, expires_at: datetime) -> None:
    """Marks one signed-in session as no longer valid.

    Idempotent: signing out twice, or a retried request, must not raise on the
    duplicate primary key.
    """
    existing = await db.get(RevokedSession, session_id)
    if existing is not None:
        return
    db.add(RevokedSession(session_id=session_id, expires_at=expires_at))
    await db.flush()


async def is_session_revoked(db: AsyncSession, session_id: str | None) -> bool:
    """Tokens minted before revocation existed carry no `sid`.

    Those are treated as revoked rather than trusted: they predate the fix, so
    they are exactly the tokens that could be circulating from a logout that
    did not actually end the session. The cost is that everyone signs in once
    after deploy.
    """
    if not session_id:
        return True
    return await db.get(RevokedSession, session_id) is not None


async def purge_expired_revocations(db: AsyncSession) -> int:
    """Drops rows whose token has expired on its own.

    A revocation only has to outlive the token it cancels; past that the JWT's
    own `exp` does the work and the row is dead weight.
    """
    result = await db.execute(
        delete(RevokedSession).where(RevokedSession.expires_at < datetime.now(timezone.utc))
    )
    return result.rowcount or 0


async def account_is_active(db: AsyncSession, employee_id: str | None) -> bool:
    """Re-checks the account behind a token on every request.

    A JWT is a snapshot of who someone was when they signed in. Without this
    the snapshot outlives the account: deleting or disabling an employee left
    their existing token working — reads and writes both — until it expired
    hours later. The bootstrap super admin has no employee row and is checked
    at login against the environment instead, so it passes here.
    """
    if employee_id is None:
        return True
    employee = await db.get(Employee, employee_id)
    return employee is not None and not employee.disabled
