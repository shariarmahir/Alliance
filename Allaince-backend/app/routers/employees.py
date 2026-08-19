from fastapi import APIRouter, HTTPException, status

from app.core.deps import AdminDep, DbSession, SuperAdminDep, owns_or_super
from app.schemas.employee import (
    DailyReportCreate,
    DailyReportOut,
    EmployeeCreate,
    EmployeeOut,
    EmployeeUpdate,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveStatusUpdate,
    TaskCreate,
    TaskOut,
    TaskStatusUpdate,
)
from app.services import employees as svc

router = APIRouter(prefix="/api/admin", tags=["employees"])


def _forbidden() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


# --- Employees (super admin only) -------------------------------------------


@router.get("/employees", response_model=list[EmployeeOut])
async def list_employees(session: SuperAdminDep, db: DbSession):
    # EmployeeOut has no password field, so the hash cannot leak through here.
    return [EmployeeOut.model_validate(e) for e in await svc.list_employees(db)]


@router.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate, session: SuperAdminDep, db: DbSession):
    try:
        employee = await svc.create_employee(db, payload.model_dump())
    except svc.DuplicateEmployee as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return EmployeeOut.model_validate(employee)


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: str, payload: EmployeeUpdate, session: SuperAdminDep, db: DbSession
):
    try:
        employee = await svc.update_employee(
            db, employee_id, payload.model_dump(exclude_unset=True)
        )
    except svc.DuplicateEmployee as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return EmployeeOut.model_validate(employee)


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(employee_id: str, session: SuperAdminDep, db: DbSession):
    if not await svc.delete_employee(db, employee_id):
        raise HTTPException(status_code=404, detail="Employee not found.")


# --- Tasks ------------------------------------------------------------------


async def _decorate_tasks(db, tasks) -> list[TaskOut]:
    names = await svc.employee_names(db)
    return [
        TaskOut.model_validate(
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "assignee_employee_id": t.assignee_employee_id,
                # Orphaned rows survive an employee delete and render as Unknown.
                "assignee_name": names.get(t.assignee_employee_id) or "Unknown Employee",
                "due_date": t.due_date,
                "status": t.status,
                "created_at": t.created_at,
            }
        )
        for t in tasks
    ]


@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(session: AdminDep, db: DbSession):
    # A sub-admin sees only their own tasks; a super admin sees the board.
    scope = None if session.role == "super" else session.employee_id
    return await _decorate_tasks(db, await svc.list_tasks(db, employee_id=scope))


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, session: SuperAdminDep, db: DbSession):
    """Assigning work is a super-admin action."""
    if await svc.get_employee(db, payload.assignee_employee_id) is None:
        raise HTTPException(status_code=400, detail="Unknown assignee.")
    task = await svc.create_task(db, payload.model_dump())
    return (await _decorate_tasks(db, [task]))[0]


@router.patch("/tasks/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: str, payload: TaskStatusUpdate, session: AdminDep, db: DbSession
):
    task = await svc.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    # Role alone is not enough here: a sub-admin may progress their own task
    # but must not touch a colleague's.
    if not owns_or_super(session, task.assignee_employee_id):
        raise _forbidden()

    updated = await svc.update_task_status(db, task_id, payload.status)
    return (await _decorate_tasks(db, [updated]))[0]


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, session: SuperAdminDep, db: DbSession):
    if not await svc.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found.")


# --- Leave requests ---------------------------------------------------------


async def _decorate_leave(db, requests) -> list[LeaveRequestOut]:
    names = await svc.employee_names(db)
    return [
        LeaveRequestOut.model_validate(
            {
                "id": r.id,
                "employee_id": r.employee_id,
                "employee_name": names.get(r.employee_id) or "Unknown Employee",
                "start_date": r.start_date,
                "end_date": r.end_date,
                "reason": r.reason,
                "status": r.status,
                "submitted_at": r.submitted_at,
            }
        )
        for r in requests
    ]


@router.get("/leave-requests", response_model=list[LeaveRequestOut])
async def list_leave_requests(session: AdminDep, db: DbSession):
    scope = None if session.role == "super" else session.employee_id
    return await _decorate_leave(db, await svc.list_leave_requests(db, employee_id=scope))


@router.post(
    "/leave-requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED
)
async def create_leave_request(payload: LeaveRequestCreate, session: AdminDep, db: DbSession):
    data = payload.model_dump()
    # A sub-admin always files for themselves, whatever the body claims.
    if session.role != "super":
        if not session.employee_id:
            raise HTTPException(
                status_code=400, detail="This account is not linked to an employee record."
            )
        data["employee_id"] = session.employee_id
    request = await svc.create_leave_request(db, data)
    return (await _decorate_leave(db, [request]))[0]


@router.patch("/leave-requests/{request_id}/status", response_model=LeaveRequestOut)
async def update_leave_status(
    request_id: str, payload: LeaveStatusUpdate, session: SuperAdminDep, db: DbSession
):
    """Approving one's own leave would defeat the point, so this is super-only."""
    request = await svc.update_leave_status(db, request_id, payload.status)
    if request is None:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    return (await _decorate_leave(db, [request]))[0]


# --- Daily reports ----------------------------------------------------------


async def _decorate_reports(db, reports) -> list[DailyReportOut]:
    names = await svc.employee_names(db)
    return [
        DailyReportOut.model_validate(
            {
                "id": r.id,
                "employee_id": r.employee_id,
                "employee_name": names.get(r.employee_id) or "Unknown Employee",
                "date": r.date,
                "hours_worked": r.hours_worked,
                "summary": r.summary,
                "submitted_at": r.submitted_at,
            }
        )
        for r in reports
    ]


@router.get("/daily-reports", response_model=list[DailyReportOut])
async def list_daily_reports(session: AdminDep, db: DbSession):
    scope = None if session.role == "super" else session.employee_id
    return await _decorate_reports(db, await svc.list_daily_reports(db, employee_id=scope))


@router.post(
    "/daily-reports", response_model=DailyReportOut, status_code=status.HTTP_201_CREATED
)
async def create_daily_report(payload: DailyReportCreate, session: AdminDep, db: DbSession):
    data = payload.model_dump()
    if session.role != "super":
        if not session.employee_id:
            raise HTTPException(
                status_code=400, detail="This account is not linked to an employee record."
            )
        data["employee_id"] = session.employee_id
    report = await svc.create_daily_report(db, data)
    return (await _decorate_reports(db, [report]))[0]
