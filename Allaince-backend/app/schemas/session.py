from typing import Literal, get_args

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

AdminRole = Literal["super", "sub"]
# Areas a sub-admin cannot reach by default but can be granted individually.
# "invoices" and "challans" were split out of "orders": billing and dispatch
# are separate jobs, and someone who updates delivery status has no business
# approving an invoice. See IMPLIED_AREAS for what that split does to the
# accounts that already existed.
AccessArea = Literal[
    "quotations", "orders", "invoices", "challans", "emails", "contact-requests"
]

# The same set at runtime, for code that filters rather than validates.
# session_token.py drops unrecognised areas from an incoming token, and a
# hardcoded copy there that fell behind this literal would silently revoke a
# real grant -- no error, no log, just a 403 nobody can account for.
ACCESS_AREAS: frozenset[str] = frozenset(get_args(AccessArea))

# Grants that carry others with them.
#
# Before the split, "orders" was the only grant covering invoices and
# challans, so every sub-admin holding it could reach both. Making the new
# areas stand alone would have silently revoked that access on deploy --
# nobody's stored access_options would change, but what they opened would.
# So "orders" keeps implying both, and a fresh account can be granted the
# narrower ones on their own.
IMPLIED_AREAS: dict[str, tuple[str, ...]] = {
    "orders": ("invoices", "challans"),
}


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
