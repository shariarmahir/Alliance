from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

AdminRole = Literal["super", "sub"]
# Areas a sub-admin cannot reach by default but can be granted individually.
AccessArea = Literal["quotations", "orders", "emails", "contact-requests"]


class CamelModel(BaseModel):
    """Base for every schema crossing the wire.

    The frontend's TypeScript types are camelCase, so responses serialise to
    camelCase and requests accept either casing. Python stays snake_case.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class AdminSession(CamelModel):
    role: AdminRole
    name: str
    email: str
    employee_id: str | None = None
    access_options: list[AccessArea] | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(CamelModel):
    session: AdminSession
    redirect_to: str = "/admin"
