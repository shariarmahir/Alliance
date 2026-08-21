from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import DailyReport, Employee, LeaveRequest, Task
from app.models.base import business_today


class DuplicateEmployee(ValueError):
    """Email or employee ID number already in use."""


# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------


async def list_employees(db: AsyncSession) -> list[Employee]:
    return list((await db.execute(select(Employee).order_by(Employee.name))).scalars().all())


async def get_employee(db: AsyncSession, employee_id: str) -> Employee | None:
    return await db.get(Employee, employee_id)


async def _assert_unique(
    db: AsyncSession, email: str | None, id_number: str | None, exclude_id: str | None = None
) -> None:
    if email:
        stmt = select(Employee).where(func.lower(Employee.email) == email.lower())
        if exclude_id:
            stmt = stmt.where(Employee.id != exclude_id)
        if (await db.execute(stmt)).scalar_one_or_none():
            raise DuplicateEmployee(f'An employee with the email "{email}" already exists.')
    if id_number:
        stmt = select(Employee).where(Employee.employee_id_number == id_number)
        if exclude_id:
            stmt = stmt.where(Employee.id != exclude_id)
        if (await db.execute(stmt)).scalar_one_or_none():
            raise DuplicateEmployee(f'Employee ID "{id_number}" is already assigned.')


async def create_employee(db: AsyncSession, data: dict) -> Employee:
    email = data["email"].strip().lower()
    await _assert_unique(db, email, data["employee_id_number"])

    employee = Employee(
        employee_id_number=data["employee_id_number"].strip(),
        name=data["name"].strip(),
        email=email,
        # Hashing happens here so a plaintext password can never be persisted,
        # regardless of which caller creates the row.
        password_hash=hash_password(data["password"]),
        designation=data.get("designation", "other"),
        custom_designation=data.get("custom_designation"),
        role=data.get("role", "sub"),
        access_options=data.get("access_options", []),
        disabled=False,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


async def update_employee(db: AsyncSession, employee_id: str, patch: dict) -> Employee | None:
    employee = await get_employee(db, employee_id)
    if employee is None:
        return None

    email = patch.get("email")
    if email:
        email = email.strip().lower()
    await _assert_unique(db, email, patch.get("employee_id_number"), exclude_id=employee_id)

    for key, value in patch.items():
        if value is None or key == "password":
            continue
        if key == "email":
            employee.email = email
        elif hasattr(employee, key):
            setattr(employee, key, value)

    if patch.get("password"):
        employee.password_hash = hash_password(patch["password"])

    await db.commit()
    await db.refresh(employee)
    return employee


async def delete_employee(db: AsyncSession, employee_id: str) -> bool:
    """Hard delete. Soft-delete via `disabled` is preferred — tasks, leave
    requests and reports reference employees and render as "Unknown Employee"
    once the row is gone (their FKs are ON DELETE SET NULL, so they survive)."""
    employee = await get_employee(db, employee_id)
    if employee is None:
        return False
    await db.delete(employee)
    await db.commit()
    return True


async def employee_names(db: AsyncSession) -> dict[str, str]:
    """Id → name map for decorating tasks/leave/reports in one query."""
    rows = (await db.execute(select(Employee.id, Employee.name))).all()
    return {row[0]: row[1] for row in rows}


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


async def list_tasks(db: AsyncSession, employee_id: str | None = None) -> list[Task]:
    stmt = select(Task).order_by(Task.created_at.desc())
    if employee_id:
        stmt = stmt.where(Task.assignee_employee_id == employee_id)
    return list((await db.execute(stmt)).scalars().all())


async def get_task(db: AsyncSession, task_id: str) -> Task | None:
    return await db.get(Task, task_id)


async def create_task(db: AsyncSession, data: dict) -> Task:
    task = Task(
        title=data["title"].strip(),
        description=data.get("description", ""),
        assignee_employee_id=data["assignee_employee_id"],
        due_date=data.get("due_date"),
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def update_task_status(db: AsyncSession, task_id: str, status: str) -> Task | None:
    task = await get_task(db, task_id)
    if task is None:
        return None
    task.status = status
    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, task_id: str) -> bool:
    task = await get_task(db, task_id)
    if task is None:
        return False
    await db.delete(task)
    await db.commit()
    return True


# ---------------------------------------------------------------------------
# Leave requests
# ---------------------------------------------------------------------------


async def list_leave_requests(
    db: AsyncSession, employee_id: str | None = None
) -> list[LeaveRequest]:
    stmt = select(LeaveRequest).order_by(LeaveRequest.submitted_at.desc())
    if employee_id:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
    return list((await db.execute(stmt)).scalars().all())


async def get_leave_request(db: AsyncSession, request_id: str) -> LeaveRequest | None:
    return await db.get(LeaveRequest, request_id)


async def create_leave_request(db: AsyncSession, data: dict) -> LeaveRequest:
    request = LeaveRequest(
        employee_id=data.get("employee_id"),
        start_date=data["start_date"],
        end_date=data["end_date"],
        reason=data.get("reason", ""),
        status="pending",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


async def update_leave_status(
    db: AsyncSession, request_id: str, status: str
) -> LeaveRequest | None:
    request = await get_leave_request(db, request_id)
    if request is None:
        return None
    request.status = status
    await db.commit()
    await db.refresh(request)
    return request


# ---------------------------------------------------------------------------
# Daily reports
# ---------------------------------------------------------------------------


async def list_daily_reports(
    db: AsyncSession, employee_id: str | None = None
) -> list[DailyReport]:
    stmt = select(DailyReport).order_by(DailyReport.date.desc(), DailyReport.submitted_at.desc())
    if employee_id:
        stmt = stmt.where(DailyReport.employee_id == employee_id)
    return list((await db.execute(stmt)).scalars().all())


async def create_daily_report(db: AsyncSession, data: dict) -> DailyReport:
    report = DailyReport(
        employee_id=data.get("employee_id"),
        # Defaults to the submission day in Dhaka, not UTC: a report filed
        # before 06:00 local would otherwise be dated to the previous day.
        date=data.get("date") or business_today(),
        hours_worked=float(data.get("hours_worked", 0)),
        summary=data["summary"],
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
