from datetime import date as _date
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, model_validator

from app.schemas.session import AccessArea, AdminRole, CamelModel

Designation = Literal[
    "sales-associate", "warehouse-staff", "support-agent", "catalog-manager", "other"
]
TaskStatus = Literal["pending", "in-progress", "completed"]
LeaveStatus = Literal["pending", "approved", "rejected"]


class EmployeeOut(CamelModel):
    """The only employee shape allowed across an API boundary — no password."""

    id: str
    employee_id_number: str
    name: str
    email: str
    designation: Designation
    custom_designation: str | None = None
    role: AdminRole
    access_options: list[AccessArea]
    disabled: bool
    created_at: datetime


class EmployeeCreate(CamelModel):
    employee_id_number: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    designation: Designation = "other"
    custom_designation: str | None = Field(default=None, max_length=200)
    role: AdminRole = "sub"
    access_options: list[AccessArea] = Field(default_factory=list)

    @model_validator(mode="after")
    def _custom_designation_required_for_other(self):
        if self.designation == "other" and not (self.custom_designation or "").strip():
            raise ValueError("customDesignation is required when designation is 'other'.")
        return self


class EmployeeUpdate(CamelModel):
    employee_id_number: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)
    designation: Designation | None = None
    custom_designation: str | None = Field(default=None, max_length=200)
    role: AdminRole | None = None
    access_options: list[AccessArea] | None = None
    disabled: bool | None = None


class TaskOut(CamelModel):
    id: str
    title: str
    description: str
    assignee_employee_id: str | None
    assignee_name: str | None = None
    due_date: _date | None
    status: TaskStatus
    created_at: datetime


class TaskCreate(CamelModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=5000)
    assignee_employee_id: str
    due_date: _date | None = None


class TaskStatusUpdate(CamelModel):
    status: TaskStatus


class LeaveRequestOut(CamelModel):
    id: str
    employee_id: str | None
    employee_name: str | None = None
    start_date: _date
    end_date: _date
    reason: str
    status: LeaveStatus
    submitted_at: datetime


class LeaveRequestCreate(CamelModel):
    start_date: _date
    end_date: _date
    reason: str = Field(default="", max_length=2000)
    # Super admins may file on behalf of an employee; sub-admins always file
    # for themselves and this is ignored in favour of their session identity.
    employee_id: str | None = None

    @model_validator(mode="after")
    def _end_after_start(self):
        if self.end_date < self.start_date:
            raise ValueError("endDate cannot be before startDate.")
        return self


class LeaveStatusUpdate(CamelModel):
    status: LeaveStatus


class DailyReportOut(CamelModel):
    id: str
    employee_id: str | None
    employee_name: str | None = None
    date: _date
    hours_worked: float
    summary: str
    submitted_at: datetime


class DailyReportCreate(CamelModel):
    date: _date | None = None
    hours_worked: float = Field(ge=0, le=24)
    summary: str = Field(min_length=1, max_length=5000)
    employee_id: str | None = None
