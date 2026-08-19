from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_bootstrap_hash, verify_password
from app.models import Employee
from app.schemas.session import AdminSession


async def verify_admin_credentials(
    db: AsyncSession, email: str, password: str
) -> AdminSession | None:
    """Bootstrap super admin first, then the employee roster.

    Returns None for every failure mode (unknown email, wrong password,
    disabled account) so the caller cannot leak which one occurred.
    """
    normalized = email.strip().lower()

    # The bootstrap super admin lives in the environment, not the database —
    # it is what lets an operator log in to a freshly migrated system.
    bootstrap_email = (settings.super_admin_email or "").strip().lower()
    bootstrap_hash = decode_bootstrap_hash(settings.super_admin_password_hash_b64)
    if bootstrap_email and bootstrap_hash and normalized == bootstrap_email:
        if verify_password(password, bootstrap_hash):
            return AdminSession(
                role="super", name=settings.super_admin_name, email=bootstrap_email
            )
        return None

    employee = (
        await db.execute(select(Employee).where(Employee.email == normalized))
    ).scalar_one_or_none()
    if employee is None or employee.disabled:
        return None
    if not verify_password(password, employee.password_hash):
        return None

    return AdminSession(
        role=employee.role or "sub",
        name=employee.name,
        email=employee.email,
        employee_id=employee.id,
        access_options=list(employee.access_options or []),
    )
