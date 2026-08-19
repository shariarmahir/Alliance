from app.core.security import hash_password
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Employee
from app.schemas.session import AdminSession

NEW_EMPLOYEE = {
    "employeeIdNumber": "EMP-0042",
    "name": "Bea Staff",
    "email": "bea@autolink.com",
    "password": "staff-password-1",
    "designation": "sales-associate",
    "role": "sub",
    "accessOptions": ["orders"],
}


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


async def _seed_employee(db, employee_id="emp-1", email="one@x.com", id_number="EMP-1"):
    employee = Employee(
        id=employee_id,
        employee_id_number=id_number,
        name="Employee One",
        email=email,
        password_hash=hash_password("password-123"),
        designation="support-agent",
    )
    db.add(employee)
    await db.commit()
    return employee


# --- employee CRUD ----------------------------------------------------------


async def test_employee_routes_are_super_admin_only(client):
    _auth(client, role="sub", employee_id="emp-1")
    assert (await client.get("/api/admin/employees")).status_code == 403
    assert (await client.post("/api/admin/employees", json=NEW_EMPLOYEE)).status_code == 403


async def test_create_employee_hashes_password_and_never_returns_it(client, db):
    _auth(client)
    r = await client.post("/api/admin/employees", json=NEW_EMPLOYEE)
    assert r.status_code == 201
    assert "password" not in r.text.lower()
    assert "$2b$" not in r.text

    stored = (await _fetch_employee(db, "bea@autolink.com")).password_hash
    assert stored.startswith("$2b$12$")
    assert stored != NEW_EMPLOYEE["password"]


async def _fetch_employee(db, email):
    from sqlalchemy import select

    return (await db.execute(select(Employee).where(Employee.email == email))).scalar_one()


async def test_duplicate_email_is_rejected(client):
    _auth(client)
    await client.post("/api/admin/employees", json=NEW_EMPLOYEE)
    r = await client.post(
        "/api/admin/employees", json={**NEW_EMPLOYEE, "employeeIdNumber": "EMP-0099"}
    )
    assert r.status_code == 409


async def test_duplicate_employee_id_number_is_rejected(client):
    _auth(client)
    await client.post("/api/admin/employees", json=NEW_EMPLOYEE)
    r = await client.post(
        "/api/admin/employees", json={**NEW_EMPLOYEE, "email": "other@autolink.com"}
    )
    assert r.status_code == 409


async def test_password_change_is_rehashed(client, db):
    _auth(client)
    created = (await client.post("/api/admin/employees", json=NEW_EMPLOYEE)).json()
    before = (await _fetch_employee(db, "bea@autolink.com")).password_hash

    r = await client.patch(
        f"/api/admin/employees/{created['id']}", json={"password": "a-new-password-2"}
    )
    assert r.status_code == 200
    await db.commit()
    after = (await _fetch_employee(db, "bea@autolink.com")).password_hash
    assert after != before and after.startswith("$2b$12$")


async def test_designation_other_requires_a_custom_label(client):
    _auth(client)
    payload = {**NEW_EMPLOYEE, "designation": "other", "customDesignation": ""}
    assert (await client.post("/api/admin/employees", json=payload)).status_code == 422


# --- task ownership ---------------------------------------------------------


async def test_sub_admin_can_update_own_task_but_not_a_colleagues(client, db):
    await _seed_employee(db, "emp-1", "one@x.com", "EMP-1")
    await _seed_employee(db, "emp-2", "two@x.com", "EMP-2")

    _auth(client)
    mine = (
        await client.post(
            "/api/admin/tasks",
            json={"title": "Mine", "assigneeEmployeeId": "emp-1", "description": ""},
        )
    ).json()
    theirs = (
        await client.post(
            "/api/admin/tasks",
            json={"title": "Theirs", "assigneeEmployeeId": "emp-2", "description": ""},
        )
    ).json()

    _auth(client, role="sub", employee_id="emp-1")
    ok = await client.patch(f"/api/admin/tasks/{mine['id']}/status", json={"status": "completed"})
    assert ok.status_code == 200 and ok.json()["status"] == "completed"

    # Role alone is not enough — ownership is what blocks this.
    denied = await client.patch(
        f"/api/admin/tasks/{theirs['id']}/status", json={"status": "completed"}
    )
    assert denied.status_code == 403


async def test_sub_admin_only_sees_their_own_tasks(client, db):
    await _seed_employee(db, "emp-1", "one@x.com", "EMP-1")
    await _seed_employee(db, "emp-2", "two@x.com", "EMP-2")
    _auth(client)
    for employee_id in ("emp-1", "emp-2"):
        await client.post(
            "/api/admin/tasks",
            json={"title": f"T-{employee_id}", "assigneeEmployeeId": employee_id},
        )

    assert len((await client.get("/api/admin/tasks")).json()) == 2

    _auth(client, role="sub", employee_id="emp-1")
    mine = (await client.get("/api/admin/tasks")).json()
    assert len(mine) == 1 and mine[0]["assigneeEmployeeId"] == "emp-1"


async def test_only_super_admin_assigns_tasks(client, db):
    await _seed_employee(db)
    _auth(client, role="sub", employee_id="emp-1")
    r = await client.post(
        "/api/admin/tasks", json={"title": "Self assigned", "assigneeEmployeeId": "emp-1"}
    )
    assert r.status_code == 403


async def test_task_assignee_must_exist(client):
    _auth(client)
    r = await client.post(
        "/api/admin/tasks", json={"title": "T", "assigneeEmployeeId": "nobody"}
    )
    assert r.status_code == 400


async def test_deleted_employee_leaves_task_as_unknown(client, db):
    employee = await _seed_employee(db)
    _auth(client)
    await client.post("/api/admin/tasks", json={"title": "Orphan", "assigneeEmployeeId": "emp-1"})

    assert (await client.delete(f"/api/admin/employees/{employee.id}")).status_code == 204

    # SET NULL, not CASCADE — the historical task must survive.
    tasks = (await client.get("/api/admin/tasks")).json()
    assert len(tasks) == 1
    assert tasks[0]["assigneeEmployeeId"] is None
    assert tasks[0]["assigneeName"] == "Unknown Employee"


# --- leave and reports ------------------------------------------------------


async def test_sub_admin_leave_request_is_filed_under_their_own_id(client, db):
    await _seed_employee(db, "emp-1", "one@x.com", "EMP-1")
    await _seed_employee(db, "emp-2", "two@x.com", "EMP-2")
    _auth(client, role="sub", employee_id="emp-1")

    # Claiming someone else's id in the body must not work.
    r = await client.post(
        "/api/admin/leave-requests",
        json={
            "startDate": "2026-09-01",
            "endDate": "2026-09-03",
            "reason": "Family",
            "employeeId": "emp-2",
        },
    )
    assert r.status_code == 201
    assert r.json()["employeeId"] == "emp-1"


async def test_leave_end_date_cannot_precede_start(client, db):
    await _seed_employee(db)
    _auth(client, role="sub", employee_id="emp-1")
    r = await client.post(
        "/api/admin/leave-requests",
        json={"startDate": "2026-09-10", "endDate": "2026-09-01", "reason": "x"},
    )
    assert r.status_code == 422


async def test_only_super_admin_approves_leave(client, db):
    await _seed_employee(db)
    _auth(client, role="sub", employee_id="emp-1")
    created = (
        await client.post(
            "/api/admin/leave-requests",
            json={"startDate": "2026-09-01", "endDate": "2026-09-02", "reason": "x"},
        )
    ).json()

    # Approving one's own leave would defeat the point.
    denied = await client.patch(
        f"/api/admin/leave-requests/{created['id']}/status", json={"status": "approved"}
    )
    assert denied.status_code == 403

    _auth(client)
    ok = await client.patch(
        f"/api/admin/leave-requests/{created['id']}/status", json={"status": "approved"}
    )
    assert ok.status_code == 200 and ok.json()["status"] == "approved"


async def test_daily_report_defaults_to_today_and_is_self_scoped(client, db):
    from datetime import date

    await _seed_employee(db)
    _auth(client, role="sub", employee_id="emp-1")
    r = await client.post(
        "/api/admin/daily-reports", json={"hoursWorked": 8, "summary": "Shipped orders"}
    )
    assert r.status_code == 201
    assert r.json()["date"] == date.today().isoformat()
    assert r.json()["employeeId"] == "emp-1"


async def test_daily_report_rejects_impossible_hours(client, db):
    await _seed_employee(db)
    _auth(client, role="sub", employee_id="emp-1")
    r = await client.post("/api/admin/daily-reports", json={"hoursWorked": 30, "summary": "x"})
    assert r.status_code == 422
