# Standalone FastAPI Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, production-ready FastAPI + PostgreSQL backend at
`Allaince-backend/` that replaces every backend concern currently embedded in the
`Alliance-frontend` Next.js app (catalog, quotations/orders, admin auth/RBAC,
employee/task/leave management, analytics, Gmail OAuth inbox, PDF generation,
transactional email), then wire the frontend to call it over HTTP instead of its own
Route Handlers.

**Architecture:** FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic migrations +
Pydantic v2 schemas, organized as `models/` (ORM) → `schemas/` (Pydantic) →
`services/` (business logic) → `routers/` (HTTP layer), with `core/` for auth/RBAC/
rate-limiting and `integrations/` for Gmail OAuth, email sending, PDF rendering, and
object storage. JWT-in-httpOnly-cookie sessions carry over unchanged in spirit;
per-request RBAC dependencies replace the frontend's route middleware.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x (async, `asyncpg` driver),
Alembic, Pydantic v2 + pydantic-settings, `passlib[bcrypt]`, `python-jose`,
`google-auth-oauthlib` + `google-api-python-client`, `resend`, WeasyPrint, `boto3`
(S3-compatible client), `redis` (rate limiting), `pytest` + `pytest-asyncio` +
`httpx` (testing), PostgreSQL 16.

## Global Constraints

- Folder name is `Allaince-backend` (sibling to `Alliance-frontend`, one level under
  the repo root `M:\Private projects\Alliance\`) — this is the existing, intentional
  (if typo'd) name; do not rename it.
- All config comes from environment variables via `pydantic-settings` — no
  hardcoded secrets, hosts, or credentials anywhere in source.
- Session cookie name stays `autolink_admin_session` (matches the frontend's existing
  cookie name so no frontend cookie-handling rename is required).
- Session shape stays `{ role: "super" | "sub", name, email, employee_id?,
  access_options? }` (snake_case in Python/JSON on the wire is fine — Pydantic's
  default alias behavior can keep the JSON camelCase if the frontend expects that;
  decide per Task 3 and keep it consistent across all schemas).
- Password hashing stays bcrypt (`passlib[bcrypt]`, cost 12, matching
  `bcrypt.hash(plain, 12)` today).
- JWT session TTL stays 8 hours, HS256, secret from `SESSION_SECRET` env var
  (>= 32 chars, fail loudly if missing/short — same as today's `session-token.ts`).
- RBAC stays three-tier: `require_super_admin`, `require_area(area)`,
  `require_admin` — matching `_auth.ts`'s `requireSuperAdminSession`,
  `requireAreaSession`, `requireAdminSession` exactly.
- Stock status thresholds stay: `qty <= 0` → `out-of-stock`, `qty < 10` →
  `low-stock`, else `in-stock` (from `deriveStockStatus` in `admin-catalog.ts`).
- Bulk-import stock backfill stays: `in-stock` → 50, `low-stock` → 5, `out-of-stock`
  → 0 (from `defaultStockQtyForStatus`).
- Quotation confirmation retraction stays: setting quotation status to anything other
  than `"confirmed"` deletes the associated `order_confirmations` row (matches
  `updateQuotationStatus`'s `delete quotation.confirmation`).
- Confirmation ref-number sequence stays global (count of all issued confirmations +
  1), not per-customer (from `nextConfirmationSequence`).
- Analytics windows stay rolling, not calendar-aligned: week = last 7 days, month =
  last 30 days, year = last 12 months; delta is `null` (not `0`) when there is no
  prior-period baseline; cancelled orders excluded from revenue (from
  `admin-analytics.ts`).
- Employee delete stays soft-delete-preferred but hard-delete-permitted, with
  `ON DELETE SET NULL` (not CASCADE) on `tasks`/`leave_requests`/`daily_reports` →
  `employees` foreign keys, so orphaned records survive as "Unknown Employee".
- Slug collisions on product/category names append `-2`, `-3`, ... rather than
  erroring (from `uniqueSlug`).
- Gmail integration stays read-only (`gmail.readonly` scope only, no send).
- Every step in this plan that touches code must be followed by running the test
  suite for that module before moving on — do not batch verification to the end.

---

## Phase 1: Project Scaffold, Database, Config, Auth Core

### Task 1: Project scaffold and dependency setup

**Files:**
- Create: `Allaince-backend/pyproject.toml`
- Create: `Allaince-backend/app/__init__.py`
- Create: `Allaince-backend/app/main.py`
- Create: `Allaince-backend/app/config.py`
- Create: `Allaince-backend/.env.example`
- Create: `Allaince-backend/.gitignore`
- Create: `Allaince-backend/tests/__init__.py`
- Create: `Allaince-backend/tests/conftest.py`

**Interfaces:**
- Produces: `app.config.settings` (a `Settings` instance), `app.main.app` (the
  FastAPI instance), used by every later task.

- [ ] **Step 1: Create the project directory and `pyproject.toml`**

```toml
[project]
name = "allaince-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.30",
    "alembic>=1.14",
    "pydantic>=2.9",
    "pydantic-settings>=2.6",
    "passlib[bcrypt]>=1.7",
    "python-jose[cryptography]>=3.3",
    "python-multipart>=0.0.12",
    "google-auth-oauthlib>=1.2",
    "google-api-python-client>=2.150",
    "resend>=2.4",
    "weasyprint>=63.0",
    "boto3>=1.35",
    "redis>=5.2",
    "cryptography>=43.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
    "aiosqlite>=0.20",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create `.gitignore`**

```
__pycache__/
*.pyc
.env
.venv/
venv/
*.egg-info/
.pytest_cache/
```

- [ ] **Step 3: Create `.env.example`**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/allaince
SESSION_SECRET=change-me-to-a-random-32-plus-char-secret
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD_HASH_B64=
SUPER_ADMIN_NAME=Super Admin
GMAIL_TOKEN_ENCRYPTION_SECRET=change-me-to-a-random-32-plus-char-secret
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/admin/emails/oauth/callback
RESEND_API_KEY=
RESEND_FROM_EMAIL=info@auto-bd.com
S3_ENDPOINT_URL=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=allaince-images
S3_PUBLIC_BASE_URL=
REDIS_URL=redis://localhost:6379/0
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

- [ ] **Step 4: Create `app/config.py`**

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    session_secret: str
    super_admin_email: str | None = None
    super_admin_password_hash_b64: str | None = None
    super_admin_name: str = "Super Admin"
    gmail_token_encryption_secret: str
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str | None = None
    resend_api_key: str | None = None
    resend_from_email: str = "info@auto-bd.com"
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket_name: str = "allaince-images"
    s3_public_base_url: str | None = None
    redis_url: str | None = None
    cors_allowed_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

- [ ] **Step 5: Create `app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="Allaince Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 6: Create `tests/conftest.py`** (in-memory SQLite for fast unit tests
  that don't need real Postgres — integration tests in later tasks that need real
  Postgres-only features like JSONB use a separate fixture added in Task 2)

```python
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "test-secret-must-be-at-least-32-characters")
os.environ.setdefault("GMAIL_TOKEN_ENCRYPTION_SECRET", "test-secret-must-be-at-least-32-characters")

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 7: Install dependencies and verify the app boots**

Run (from `Allaince-backend/`):
```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"
```
Expected: installs without error.

- [ ] **Step 8: Write and run the first test**

Create `Allaince-backend/tests/test_health.py`:
```python
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Run: `.venv/Scripts/pytest tests/test_health.py -v`
Expected: `1 passed`

- [ ] **Step 9: Commit**

```bash
git add Allaince-backend/
git commit -m "chore: scaffold FastAPI backend project"
```

### Task 2: Database engine, session, and base model

**Files:**
- Create: `Allaince-backend/app/db.py`
- Create: `Allaince-backend/app/models/__init__.py`
- Create: `Allaince-backend/app/models/base.py`
- Test: `Allaince-backend/tests/test_db.py`

**Interfaces:**
- Consumes: `app.config.settings.database_url`
- Produces: `app.db.get_db` (FastAPI dependency yielding an `AsyncSession`),
  `app.db.engine`, `app.models.base.Base` (declarative base every model inherits
  from), `app.db.init_models()` (creates tables — used by tests and by the
  dev-only bootstrap path, not by production which uses Alembic).

- [ ] **Step 1: Create `app/models/base.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Create `app/db.py`**

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def init_models() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 3: Write the failing test**

Create `Allaince-backend/tests/test_db.py`:
```python
from sqlalchemy import text

from app.db import async_session_factory, init_models


async def test_db_connection_works():
    await init_models()
    async with async_session_factory() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar() == 1
```

- [ ] **Step 4: Run test**

Run: `.venv/Scripts/pytest tests/test_db.py -v`
Expected: `1 passed` (SQLite in-memory from conftest's env var)

- [ ] **Step 5: Commit**

```bash
git add Allaince-backend/app/db.py Allaince-backend/app/models/base.py Allaince-backend/tests/test_db.py
git commit -m "feat: add async database engine and session factory"
```

### Task 3: Session token (JWT) core — sign and parse

**Files:**
- Create: `Allaince-backend/app/schemas/session.py`
- Create: `Allaince-backend/app/core/session_token.py`
- Test: `Allaince-backend/tests/core/test_session_token.py`

**Interfaces:**
- Produces: `AdminSession` (Pydantic model: `role: Literal["super", "sub"]`,
  `name: str`, `email: str`, `employee_id: str | None = None`,
  `access_options: list[str] | None = None`), `create_session_token(session:
  AdminSession) -> str`, `parse_admin_session(raw: str | None) -> AdminSession |
  None`, `ADMIN_SESSION_COOKIE = "autolink_admin_session"`.
- This mirrors `session-token.ts` exactly: HS256, 8h TTL, returns `None` for
  missing/tampered/malformed/expired tokens (all treated the same, no distinct
  error types).

- [ ] **Step 1: Create `app/schemas/session.py`**

```python
from typing import Literal

from pydantic import BaseModel


class AdminSession(BaseModel):
    role: Literal["super", "sub"]
    name: str
    email: str
    employee_id: str | None = None
    access_options: list[str] | None = None
```

- [ ] **Step 2: Write the failing test**

Create `Allaince-backend/tests/core/__init__.py` (empty) and
`Allaince-backend/tests/core/test_session_token.py`:
```python
import pytest

from app.core.session_token import create_session_token, parse_admin_session
from app.schemas.session import AdminSession


async def test_round_trip_preserves_session_fields():
    session = AdminSession(role="super", name="Ada", email="ada@example.com")
    token = await create_session_token(session)
    parsed = await parse_admin_session(token)
    assert parsed == session


async def test_round_trip_preserves_optional_fields():
    session = AdminSession(
        role="sub",
        name="Bea",
        email="bea@example.com",
        employee_id="emp-1",
        access_options=["orders", "quotations"],
    )
    token = await create_session_token(session)
    parsed = await parse_admin_session(token)
    assert parsed == session


async def test_parse_returns_none_for_missing_token():
    assert await parse_admin_session(None) is None


async def test_parse_returns_none_for_garbage_token():
    assert await parse_admin_session("not-a-real-jwt") is None


async def test_parse_returns_none_for_tampered_token():
    session = AdminSession(role="super", name="Ada", email="ada@example.com")
    token = await create_session_token(session)
    tampered = token[:-4] + "abcd"
    assert await parse_admin_session(tampered) is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/core/test_session_token.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.core.session_token'`

- [ ] **Step 4: Create `app/core/session_token.py`**

```python
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings
from app.schemas.session import AdminSession

ADMIN_SESSION_COOKIE = "autolink_admin_session"
SESSION_TTL = timedelta(hours=8)
ALGORITHM = "HS256"


def _session_secret() -> str:
    raw = settings.session_secret
    if not raw or len(raw) < 32:
        raise RuntimeError(
            "SESSION_SECRET is missing or too short (needs >= 32 chars)."
        )
    return raw


async def create_session_token(session: AdminSession) -> str:
    now = datetime.now(timezone.utc)
    payload = session.model_dump(exclude_none=True)
    payload["iat"] = int(now.timestamp())
    payload["exp"] = int((now + SESSION_TTL).timestamp())
    return jwt.encode(payload, _session_secret(), algorithm=ALGORITHM)


async def parse_admin_session(raw: str | None) -> AdminSession | None:
    if not raw:
        return None
    try:
        payload = jwt.decode(raw, _session_secret(), algorithms=[ALGORITHM])
    except JWTError:
        return None

    if payload.get("role") not in ("super", "sub"):
        return None
    if not isinstance(payload.get("name"), str) or not isinstance(payload.get("email"), str):
        return None

    try:
        return AdminSession(
            role=payload["role"],
            name=payload["name"],
            email=payload["email"],
            employee_id=payload.get("employee_id"),
            access_options=payload.get("access_options"),
        )
    except Exception:
        return None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/core/test_session_token.py -v`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add Allaince-backend/app/schemas/session.py Allaince-backend/app/core/session_token.py Allaince-backend/tests/core/
git commit -m "feat: add JWT session token signing and parsing"
```

### Task 4: Password hashing core

**Files:**
- Create: `Allaince-backend/app/core/security.py`
- Test: `Allaince-backend/tests/core/test_security.py`

**Interfaces:**
- Produces: `hash_password(plain: str) -> str`, `password_matches(plain: str,
  stored: str) -> bool` (accepts legacy plaintext once, matching
  `admin-auth.ts`'s migration-friendly behavior).

- [ ] **Step 1: Write the failing test**

Create `Allaince-backend/tests/core/test_security.py`:
```python
from app.core.security import hash_password, password_matches


async def test_hash_password_produces_bcrypt_hash():
    hashed = hash_password("correct horse battery staple")
    assert hashed.startswith("$2b$")


async def test_password_matches_against_hash():
    hashed = hash_password("hunter2")
    assert await password_matches("hunter2", hashed) is True
    assert await password_matches("wrong", hashed) is False


async def test_password_matches_legacy_plaintext():
    assert await password_matches("101063", "101063") is True
    assert await password_matches("wrong", "101063") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/core/test_security.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Create `app/core/security.py`**

```python
import re

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_HASH_PATTERN = re.compile(r"^\$2[aby]\$\d{2}\$")


def is_hashed(password: str) -> bool:
    return bool(_HASH_PATTERN.match(password))


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


async def password_matches(plain: str, stored: str) -> bool:
    if is_hashed(stored):
        return _pwd_context.verify(plain, stored)
    return plain == stored
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/core/test_security.py -v`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add Allaince-backend/app/core/security.py Allaince-backend/tests/core/test_security.py
git commit -m "feat: add bcrypt password hashing with legacy plaintext migration path"
```

---

## Phase 2: Employee Model, Auth Endpoints, RBAC Dependencies

### Task 5: Employee, Task, LeaveRequest, DailyReport models

**Files:**
- Create: `Allaince-backend/app/models/employee.py`
- Modify: `Allaince-backend/app/models/__init__.py` (import new models so
  `Base.metadata` sees them)
- Test: `Allaince-backend/tests/models/test_employee.py`

**Interfaces:**
- Produces: `Employee` (columns: `id: str` UUID PK, `employee_id_number: str`
  unique, `name: str`, `email: str` unique, `password_hash: str`,
  `designation: str`, `custom_designation: str | None`, `role: str` default
  `"sub"`, `access_options: list[str]` JSON default `[]`, `disabled: bool` default
  `False`, `created_at: datetime`), `Task` (id UUID PK, title, description,
  `assignee_employee_id: str | None` FK→employees.id `ON DELETE SET NULL`,
  due_date, status default `"pending"`, created_at), `LeaveRequest` (id UUID PK,
  `employee_id: str | None` FK SET NULL, start_date, end_date, reason, status
  default `"pending"`, submitted_at), `DailyReport` (id UUID PK, `employee_id: str
  | None` FK SET NULL, date, hours_worked: float, summary, submitted_at).

- [ ] **Step 1: Write the failing test**

Create `Allaince-backend/tests/models/__init__.py` (empty) and
`Allaince-backend/tests/models/test_employee.py`:
```python
import uuid
from datetime import datetime, timezone

from app.db import async_session_factory, init_models
from app.models.employee import DailyReport, Employee, LeaveRequest, Task


async def test_create_and_read_employee():
    await init_models()
    async with async_session_factory() as session:
        employee = Employee(
            id=str(uuid.uuid4()),
            employee_id_number="EMP-0001",
            name="Ada Lovelace",
            email="ada@example.com",
            password_hash="$2b$12$abcdefghijklmnopqrstuv",
            designation="support-agent",
            access_options=[],
            created_at=datetime.now(timezone.utc),
        )
        session.add(employee)
        await session.commit()

        loaded = await session.get(Employee, employee.id)
        assert loaded.email == "ada@example.com"
        assert loaded.disabled is False
        assert loaded.role == "sub"


async def test_task_survives_employee_deletion():
    await init_models()
    async with async_session_factory() as session:
        employee = Employee(
            id=str(uuid.uuid4()),
            employee_id_number="EMP-0002",
            name="Bea",
            email="bea@example.com",
            password_hash="hash",
            designation="warehouse-staff",
            access_options=[],
            created_at=datetime.now(timezone.utc),
        )
        session.add(employee)
        await session.flush()

        task = Task(
            id=str(uuid.uuid4()),
            title="Restock shelf",
            description="",
            assignee_employee_id=employee.id,
            due_date="2026-09-01",
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        session.add(task)
        await session.commit()

        await session.delete(employee)
        await session.commit()

        reloaded = await session.get(Task, task.id)
        assert reloaded is not None
        assert reloaded.assignee_employee_id is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/models/test_employee.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.employee'`

- [ ] **Step 3: Create `app/models/employee.py`**

```python
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    employee_id_number: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    designation: Mapped[str] = mapped_column(String(64))
    custom_designation: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str] = mapped_column(String(16), default="sub")
    access_options: Mapped[list[str]] = mapped_column(JSON, default=list)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(String(4000), default="")
    assignee_employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    due_date: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    start_date: Mapped[str] = mapped_column(String(10))
    end_date: Mapped[str] = mapped_column(String(10))
    reason: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    employee_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    date: Mapped[str] = mapped_column(String(10))
    hours_worked: Mapped[float] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(String(4000), default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

Note: SQLite (used by the in-memory test DB) does not enforce `ON DELETE SET NULL`
by default without `PRAGMA foreign_keys=ON` and the FK actually being enabled per
connection. Add this to `app/db.py` so the test above is meaningful:

Modify `Allaince-backend/app/db.py`, add after the `engine = create_async_engine(...)` line:
```python
from sqlalchemy import event
from sqlalchemy.engine import Engine


@event.listens_for(Engine, "connect")
def _enable_sqlite_fk(dbapi_connection, connection_record):
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
```

- [ ] **Step 4: Register the models in `app/models/__init__.py`**

```python
from app.models.base import Base
from app.models.employee import DailyReport, Employee, LeaveRequest, Task

__all__ = ["Base", "Employee", "Task", "LeaveRequest", "DailyReport"]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/models/test_employee.py -v`
Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add Allaince-backend/app/models/ Allaince-backend/app/db.py Allaince-backend/tests/models/
git commit -m "feat: add Employee, Task, LeaveRequest, DailyReport models"
```

### Task 6: Employee service layer (CRUD + safe view)

**Files:**
- Create: `Allaince-backend/app/schemas/employee.py`
- Create: `Allaince-backend/app/services/employees.py`
- Test: `Allaince-backend/tests/services/test_employees.py`

**Interfaces:**
- Consumes: `Employee` model (Task 5), `hash_password`/`password_matches` (Task 4)
- Produces: `EmployeeCreate`, `EmployeeUpdate`, `SafeEmployee` (Pydantic schemas —
  `SafeEmployee` never includes `password_hash`), and service functions:
  `list_employees(db) -> list[Employee]`, `list_safe_employees(db) ->
  list[SafeEmployee]`, `get_employee(db, id) -> Employee | None`,
  `get_employee_by_email(db, email) -> Employee | None`,
  `create_employee(db, data: EmployeeCreate) -> Employee`,
  `update_employee(db, id, patch: EmployeeUpdate) -> Employee`,
  `delete_employee(db, id) -> None`. These are the functions every later
  employee-related router/service imports.

- [ ] **Step 1: Create `app/schemas/employee.py`**

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Designation = Literal[
    "sales-associate", "warehouse-staff", "support-agent", "catalog-manager", "other"
]
AccessArea = Literal["quotations", "orders", "emails", "contact-requests"]


class EmployeeCreate(BaseModel):
    employee_id_number: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    designation: Designation
    custom_designation: str | None = None
    role: Literal["super", "sub"] | None = None
    access_options: list[AccessArea] = Field(default_factory=list)


class EmployeeUpdate(BaseModel):
    employee_id_number: str | None = None
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    designation: Designation | None = None
    custom_designation: str | None = None
    role: Literal["super", "sub"] | None = None
    access_options: list[AccessArea] | None = None
    disabled: bool | None = None


class SafeEmployee(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    employee_id_number: str
    name: str
    email: str
    designation: str
    custom_designation: str | None
    role: str
    access_options: list[str]
    disabled: bool
    created_at: datetime
```

- [ ] **Step 2: Write the failing test**

Create `Allaince-backend/tests/services/__init__.py` (empty) and
`Allaince-backend/tests/services/test_employees.py`:
```python
import pytest

from app.db import async_session_factory, init_models
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.services import employees as employee_service


async def test_create_employee_hashes_password_and_hides_it_in_safe_view():
    await init_models()
    async with async_session_factory() as session:
        created = await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0010",
                name="Cee",
                email="cee@example.com",
                password="supersecret1",
                designation="catalog-manager",
            ),
        )
        assert created.password_hash != "supersecret1"
        assert created.password_hash.startswith("$2b$")

        safe_list = await employee_service.list_safe_employees(session)
        assert all(not hasattr(e, "password_hash") for e in safe_list)


async def test_update_employee_partial_patch():
    await init_models()
    async with async_session_factory() as session:
        created = await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0011",
                name="Dee",
                email="dee@example.com",
                password="supersecret1",
                designation="other",
                custom_designation="Intern",
            ),
        )
        updated = await employee_service.update_employee(
            session, created.id, EmployeeUpdate(disabled=True)
        )
        assert updated.disabled is True
        assert updated.name == "Dee"


async def test_delete_employee_removes_row():
    await init_models()
    async with async_session_factory() as session:
        created = await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0012",
                name="Eve",
                email="eve@example.com",
                password="supersecret1",
                designation="sales-associate",
            ),
        )
        await employee_service.delete_employee(session, created.id)
        assert await employee_service.get_employee(session, created.id) is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/services/test_employees.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services'`

- [ ] **Step 4: Create `app/services/__init__.py`** (empty)

- [ ] **Step 5: Create `app/services/employees.py`**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, SafeEmployee


async def list_employees(db: AsyncSession) -> list[Employee]:
    result = await db.execute(select(Employee))
    return list(result.scalars().all())


async def list_safe_employees(db: AsyncSession) -> list[SafeEmployee]:
    return [SafeEmployee.model_validate(e) for e in await list_employees(db)]


async def get_employee(db: AsyncSession, employee_id: str) -> Employee | None:
    return await db.get(Employee, employee_id)


async def get_employee_by_email(db: AsyncSession, email: str) -> Employee | None:
    result = await db.execute(
        select(Employee).where(Employee.email == email.lower())
    )
    return result.scalar_one_or_none()


async def create_employee(db: AsyncSession, data: EmployeeCreate) -> Employee:
    employee = Employee(
        id=str(uuid.uuid4()),
        employee_id_number=data.employee_id_number,
        name=data.name,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        designation=data.designation,
        custom_designation=data.custom_designation,
        role=data.role or "sub",
        access_options=list(data.access_options),
        disabled=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


async def update_employee(
    db: AsyncSession, employee_id: str, patch: EmployeeUpdate
) -> Employee:
    employee = await db.get(Employee, employee_id)
    if employee is None:
        raise ValueError(f"Employee not found: {employee_id}")

    updates = patch.model_dump(exclude_unset=True, exclude={"password"})
    for field, value in updates.items():
        if field == "email" and value is not None:
            value = value.lower()
        setattr(employee, field, value)
    if patch.password is not None:
        employee.password_hash = hash_password(patch.password)

    await db.commit()
    await db.refresh(employee)
    return employee


async def delete_employee(db: AsyncSession, employee_id: str) -> None:
    employee = await db.get(Employee, employee_id)
    if employee is not None:
        await db.delete(employee)
        await db.commit()
```

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/services/test_employees.py -v`
Expected: `3 passed`

- [ ] **Step 7: Commit**

```bash
git add Allaince-backend/app/schemas/employee.py Allaince-backend/app/services/ Allaince-backend/tests/services/
git commit -m "feat: add employee service layer with password hashing and safe view"
```

### Task 7: Credential verification and login endpoint

**Files:**
- Create: `Allaince-backend/app/services/auth.py`
- Create: `Allaince-backend/app/schemas/auth.py`
- Create: `Allaince-backend/app/routers/auth.py`
- Modify: `Allaince-backend/app/main.py` (register router)
- Test: `Allaince-backend/tests/routers/test_auth.py`

**Interfaces:**
- Consumes: `get_employee_by_email` (Task 6), `password_matches` (Task 4),
  `create_session_token` (Task 3), `get_db` (Task 2)
- Produces: `verify_admin_credentials(db, email, password) -> AdminSession | None`
  (mirrors `verifyAdminCredentials` in `admin-auth.ts` exactly: checks bootstrap
  super-admin env vars first, then employees table; rejects disabled employees),
  `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`.

- [ ] **Step 1: Create `app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
```

- [ ] **Step 2: Write the failing test**

Create `Allaince-backend/tests/routers/__init__.py` (empty) and
`Allaince-backend/tests/routers/test_auth.py`:
```python
from app.db import async_session_factory, init_models
from app.schemas.employee import EmployeeCreate
from app.services import employees as employee_service


async def test_login_with_employee_credentials_sets_cookie(client):
    await init_models()
    async with async_session_factory() as session:
        await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0020",
                name="Frank",
                email="frank@example.com",
                password="correcthorse1",
                designation="support-agent",
            ),
        )

    response = await client.post(
        "/api/admin/login",
        json={"email": "frank@example.com", "password": "correcthorse1"},
    )
    assert response.status_code == 200
    assert "autolink_admin_session" in response.cookies
    body = response.json()
    assert body["session"]["role"] == "sub"
    assert body["session"]["email"] == "frank@example.com"


async def test_login_with_wrong_password_returns_401(client):
    await init_models()
    async with async_session_factory() as session:
        await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0021",
                name="Grace",
                email="grace@example.com",
                password="correcthorse1",
                designation="support-agent",
            ),
        )

    response = await client.post(
        "/api/admin/login",
        json={"email": "grace@example.com", "password": "wrong"},
    )
    assert response.status_code == 401


async def test_login_with_disabled_employee_returns_401(client):
    await init_models()
    async with async_session_factory() as session:
        created = await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0022",
                name="Hank",
                email="hank@example.com",
                password="correcthorse1",
                designation="support-agent",
            ),
        )
        from app.schemas.employee import EmployeeUpdate

        await employee_service.update_employee(
            session, created.id, EmployeeUpdate(disabled=True)
        )

    response = await client.post(
        "/api/admin/login",
        json={"email": "hank@example.com", "password": "correcthorse1"},
    )
    assert response.status_code == 401


async def test_me_returns_401_without_cookie(client):
    response = await client.get("/api/admin/me")
    assert response.status_code == 401


async def test_me_returns_session_after_login(client):
    await init_models()
    async with async_session_factory() as session:
        await employee_service.create_employee(
            session,
            EmployeeCreate(
                employee_id_number="EMP-0023",
                name="Ivy",
                email="ivy@example.com",
                password="correcthorse1",
                designation="support-agent",
            ),
        )

    login_response = await client.post(
        "/api/admin/login",
        json={"email": "ivy@example.com", "password": "correcthorse1"},
    )
    cookie = login_response.cookies["autolink_admin_session"]
    client.cookies.set("autolink_admin_session", cookie)

    me_response = await client.get("/api/admin/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "ivy@example.com"


async def test_logout_clears_cookie(client):
    response = await client.post("/api/admin/logout")
    assert response.status_code == 200
    assert response.cookies.get("autolink_admin_session") is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/routers/test_auth.py -v`
Expected: FAIL — `404 Not Found` on `/api/admin/login` (router not registered yet)

- [ ] **Step 4: Create `app/services/auth.py`**

```python
from app.core.security import password_matches
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession
from app.services.employees import get_employee_by_email

__all__ = ["ADMIN_SESSION_COOKIE", "create_session_token", "verify_admin_credentials"]


async def verify_admin_credentials(db, email: str, password: str) -> AdminSession | None:
    from app.config import settings
    import base64
    import bcrypt as _bcrypt

    normalized_email = email.strip().lower()

    bootstrap_email = (settings.super_admin_email or "").strip().lower()
    bootstrap_hash_b64 = settings.super_admin_password_hash_b64
    if bootstrap_email and bootstrap_hash_b64 and normalized_email == bootstrap_email:
        try:
            bootstrap_hash = base64.b64decode(bootstrap_hash_b64).decode("utf-8")
        except Exception:
            bootstrap_hash = None
        if bootstrap_hash and bootstrap_hash.startswith("$2"):
            if _bcrypt.checkpw(password.encode("utf-8"), bootstrap_hash.encode("utf-8")):
                return AdminSession(
                    role="super", name=settings.super_admin_name, email=bootstrap_email
                )
        return None

    employee = await get_employee_by_email(db, normalized_email)
    if employee is None or employee.disabled:
        return None
    if not await password_matches(password, employee.password_hash):
        return None

    return AdminSession(
        role=employee.role,
        name=employee.name,
        email=employee.email,
        employee_id=employee.id,
        access_options=employee.access_options,
    )
```

- [ ] **Step 5: Create `app/routers/__init__.py`** (empty) and `app/routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session_token import (
    ADMIN_SESSION_COOKIE,
    create_session_token,
    parse_admin_session,
)
from app.db import get_db
from app.schemas.auth import LoginRequest
from app.services.auth import verify_admin_credentials

router = APIRouter(prefix="/api/admin", tags=["auth"])

COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60


@router.post("/login")
async def login(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    session = await verify_admin_credentials(db, payload.email, payload.password)
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = await create_session_token(session)
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=token,
        max_age=COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )
    return {"session": session.model_dump(exclude_none=True)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(ADMIN_SESSION_COOKIE)
    return {"ok": True}


@router.get("/me")
async def me(
    autolink_admin_session: str | None = None,
):
    raise HTTPException(status_code=401, detail="Unauthorized")
```

The `/me` endpoint above is a placeholder that always 401s — it needs the RBAC
dependency from Task 8 to actually read the cookie. Task 8 replaces this
implementation.

- [ ] **Step 6: Register the router in `app/main.py`**

Modify `Allaince-backend/app/main.py`, add near the top:
```python
from app.routers import auth as auth_router
```
Add after the `CORSMiddleware` block:
```python
app.include_router(auth_router.router)
```

- [ ] **Step 7: Run test — expect the `/me` tests to still fail**

Run: `.venv/Scripts/pytest tests/routers/test_auth.py -v`
Expected: `test_login_*` and `test_logout_clears_cookie` PASS; `test_me_returns_*`
FAIL (expected — fixed in Task 8, which replaces the `/me` handler).

- [ ] **Step 8: Commit**

```bash
git add Allaince-backend/app/services/auth.py Allaince-backend/app/schemas/auth.py Allaince-backend/app/routers/ Allaince-backend/app/main.py Allaince-backend/tests/routers/test_auth.py
git commit -m "feat: add admin login/logout endpoints"
```

### Task 8: RBAC dependencies and `/me` endpoint

**Files:**
- Create: `Allaince-backend/app/core/rbac.py`
- Modify: `Allaince-backend/app/routers/auth.py` (replace `/me` placeholder)
- Test: `Allaince-backend/tests/core/test_rbac.py`

**Interfaces:**
- Consumes: `parse_admin_session`, `ADMIN_SESSION_COOKIE` (Task 3)
- Produces: `require_admin_session(request: Request) -> AdminSession` (401 if no
  valid cookie), `require_super_admin(session: AdminSession = Depends(...)) ->
  AdminSession` (403 if role != "super"), `require_area(area: str)` — a
  dependency factory returning a dependency that 403s unless role is "super" or
  `area` is in `session.access_options`. These three are imported by every admin
  router from Phase 3 onward — this is the FastAPI equivalent of `_auth.ts`'s
  `requireAdminSession`/`requireSuperAdminSession`/`requireAreaSession`.

- [ ] **Step 1: Write the failing test**

Create `Allaince-backend/tests/core/test_rbac.py`:
```python
import pytest
from fastapi import FastAPI, Depends
from httpx import AsyncClient, ASGITransport

from app.core.rbac import require_admin_session, require_area, require_super_admin
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession

_app = FastAPI()


@_app.get("/needs-admin")
async def needs_admin(session: AdminSession = Depends(require_admin_session)):
    return {"role": session.role}


@_app.get("/needs-super")
async def needs_super(session: AdminSession = Depends(require_super_admin)):
    return {"role": session.role}


@_app.get("/needs-orders-area")
async def needs_orders_area(session: AdminSession = Depends(require_area("orders"))):
    return {"role": session.role}


@pytest.fixture
async def rbac_client():
    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_require_admin_session_401_without_cookie(rbac_client):
    response = await rbac_client.get("/needs-admin")
    assert response.status_code == 401


async def test_require_admin_session_200_with_valid_cookie(rbac_client):
    token = await create_session_token(
        AdminSession(role="sub", name="A", email="a@example.com")
    )
    rbac_client.cookies.set(ADMIN_SESSION_COOKIE, token)
    response = await rbac_client.get("/needs-admin")
    assert response.status_code == 200


async def test_require_super_admin_403_for_sub_role(rbac_client):
    token = await create_session_token(
        AdminSession(role="sub", name="A", email="a@example.com")
    )
    rbac_client.cookies.set(ADMIN_SESSION_COOKIE, token)
    response = await rbac_client.get("/needs-super")
    assert response.status_code == 403


async def test_require_super_admin_200_for_super_role(rbac_client):
    token = await create_session_token(
        AdminSession(role="super", name="A", email="a@example.com")
    )
    rbac_client.cookies.set(ADMIN_SESSION_COOKIE, token)
    response = await rbac_client.get("/needs-super")
    assert response.status_code == 200


async def test_require_area_403_when_not_granted(rbac_client):
    token = await create_session_token(
        AdminSession(role="sub", name="A", email="a@example.com", access_options=[])
    )
    rbac_client.cookies.set(ADMIN_SESSION_COOKIE, token)
    response = await rbac_client.get("/needs-orders-area")
    assert response.status_code == 403


async def test_require_area_200_when_granted(rbac_client):
    token = await create_session_token(
        AdminSession(
            role="sub", name="A", email="a@example.com", access_options=["orders"]
        )
    )
    rbac_client.cookies.set(ADMIN_SESSION_COOKIE, token)
    response = await rbac_client.get("/needs-orders-area")
    assert response.status_code == 200


async def test_require_area_200_for_super_regardless_of_grants(rbac_client):
    token = await create_session_token(
        AdminSession(role="super", name="A", email="a@example.com")
    )
    rbac_client.cookies.set(ADMIN_SESSION_COOKIE, token)
    response = await rbac_client.get("/needs-orders-area")
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/core/test_rbac.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.core.rbac'`

- [ ] **Step 3: Create `app/core/rbac.py`**

```python
from fastapi import Depends, HTTPException, Request

from app.core.session_token import ADMIN_SESSION_COOKIE, parse_admin_session
from app.schemas.session import AdminSession


async def require_admin_session(request: Request) -> AdminSession:
    raw = request.cookies.get(ADMIN_SESSION_COOKIE)
    session = await parse_admin_session(raw)
    if session is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session


async def require_super_admin(
    session: AdminSession = Depends(require_admin_session),
) -> AdminSession:
    if session.role != "super":
        raise HTTPException(status_code=403, detail="Forbidden")
    return session


def require_area(area: str):
    async def _dependency(
        session: AdminSession = Depends(require_admin_session),
    ) -> AdminSession:
        if session.role == "super":
            return session
        if session.access_options and area in session.access_options:
            return session
        raise HTTPException(status_code=403, detail="Forbidden")

    return _dependency
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/core/test_rbac.py -v`
Expected: `7 passed`

- [ ] **Step 5: Replace the `/me` placeholder in `app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_admin_session
from app.core.session_token import (
    ADMIN_SESSION_COOKIE,
    create_session_token,
    parse_admin_session,
)
from app.db import get_db
from app.schemas.auth import LoginRequest
from app.schemas.session import AdminSession
from app.services.auth import verify_admin_credentials

router = APIRouter(prefix="/api/admin", tags=["auth"])

COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60


@router.post("/login")
async def login(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    session = await verify_admin_credentials(db, payload.email, payload.password)
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = await create_session_token(session)
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=token,
        max_age=COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
    )
    return {"session": session.model_dump(exclude_none=True)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(ADMIN_SESSION_COOKIE)
    return {"ok": True}


@router.get("/me")
async def me(session: AdminSession = Depends(require_admin_session)):
    return session.model_dump(exclude_none=True)
```

- [ ] **Step 6: Run the full auth test file**

Run: `.venv/Scripts/pytest tests/routers/test_auth.py tests/core/test_rbac.py -v`
Expected: all tests pass (the two `test_me_returns_*` tests from Task 7 now pass
too).

- [ ] **Step 7: Commit**

```bash
git add Allaince-backend/app/core/rbac.py Allaince-backend/app/routers/auth.py Allaince-backend/tests/core/test_rbac.py
git commit -m "feat: add RBAC dependencies (require_admin_session, require_super_admin, require_area) and wire /me"
```

---

## Phase 3: Catalog (Products, Categories, Brands, Image Storage)

### Task 9: Object storage integration (S3-compatible)

**Files:**
- Create: `Allaince-backend/app/integrations/object_storage.py`
- Test: `Allaince-backend/tests/integrations/test_object_storage.py`

**Interfaces:**
- Produces: `upload_image(key: str, data: bytes, content_type: str) -> str`
  (returns the public URL) — this is the single function every catalog upload
  path (product image, category icon, hero image) calls, replacing
  `saveProductImage`/`saveCategoryIcon`/`saveHeroImage`'s `put()` calls.

- [ ] **Step 1: Write the failing test** (uses `moto`'s S3 mock — add
  `moto[s3]>=5.0` to the `dev` optional-dependencies list in `pyproject.toml`
  first)

Create `Allaince-backend/tests/integrations/__init__.py` (empty) and
`Allaince-backend/tests/integrations/test_object_storage.py`:
```python
import boto3
import pytest
from moto import mock_aws

from app.config import settings


@pytest.fixture
def s3_bucket():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=settings.s3_bucket_name)
        yield client


async def test_upload_image_returns_url(s3_bucket, monkeypatch):
    monkeypatch.setattr(settings, "s3_public_base_url", "https://cdn.example.com")
    from app.integrations.object_storage import upload_image

    url = await upload_image("images/products/test/foo.jpg", b"fake-bytes", "image/jpeg")
    assert url == "https://cdn.example.com/images/products/test/foo.jpg"

    obj = s3_bucket.get_object(Bucket=settings.s3_bucket_name, Key="images/products/test/foo.jpg")
    assert obj["Body"].read() == b"fake-bytes"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/pip install "moto[s3]"` then
`.venv/Scripts/pytest tests/integrations/test_object_storage.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.integrations'`

- [ ] **Step 3: Create `app/integrations/__init__.py`** (empty) and
  `app/integrations/object_storage.py`

```python
import boto3

from app.config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        aws_access_key_id=settings.s3_access_key_id or None,
        aws_secret_access_key=settings.s3_secret_access_key or None,
    )


async def upload_image(key: str, data: bytes, content_type: str) -> str:
    client = _client()
    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    base = settings.s3_public_base_url or f"{settings.s3_endpoint_url}/{settings.s3_bucket_name}"
    return f"{base.rstrip('/')}/{key}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/integrations/test_object_storage.py -v`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add Allaince-backend/app/integrations/object_storage.py Allaince-backend/tests/integrations/ Allaince-backend/pyproject.toml
git commit -m "feat: add S3-compatible object storage integration for image uploads"
```

### Task 10: Category and Brand models, schemas, service

**Files:**
- Create: `Allaince-backend/app/models/catalog.py`
- Modify: `Allaince-backend/app/models/__init__.py`
- Create: `Allaince-backend/app/schemas/catalog.py`
- Create: `Allaince-backend/app/services/catalog.py`
- Test: `Allaince-backend/tests/services/test_catalog_categories.py`

**Interfaces:**
- Produces: `Category` model (slug PK, name, icon_url, product_count default 0),
  `Brand` model (slug PK, name, logo_url), `CategoryCreate`/`CategoryOut`,
  `slugify(name: str) -> str`, `unique_slug(base: str, existing: set[str]) -> str`
  (ported verbatim from `admin-catalog.ts`'s `slugify`/`uniqueSlug`),
  `create_category(db, name, icon_url) -> Category`, `list_categories(db) ->
  list[Category]`, `sync_category_product_counts(db) -> None` (recomputes every
  category's `product_count` from the products table — called after any product
  write, matching `syncCategoryProductCounts`).

- [ ] **Step 1: Create `app/models/catalog.py`**

```python
from sqlalchemy import JSON, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Category(Base):
    __tablename__ = "categories"

    slug: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    icon_url: Mapped[str] = mapped_column(String(500), default="")
    product_count: Mapped[int] = mapped_column(Integer, default=0)


class Brand(Base):
    __tablename__ = "brands"

    slug: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    logo_url: Mapped[str] = mapped_column(String(500), default="")


class Product(Base):
    __tablename__ = "products"

    slug: Mapped[str] = mapped_column(String(150), primary_key=True)
    part_number: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(300))
    brand_slug: Mapped[str] = mapped_column(String(100), ForeignKey("brands.slug"))
    category_slug: Mapped[str] = mapped_column(String(100), ForeignKey("categories.slug"))
    image_url: Mapped[str] = mapped_column(String(500))
    gallery: Mapped[list[str]] = mapped_column(JSON, default=list)
    short_specs: Mapped[list[str]] = mapped_column(JSON, default=list)
    description: Mapped[list[str]] = mapped_column(JSON, default=list)
    alternate_part_numbers: Mapped[list[str]] = mapped_column(JSON, default=list)
    specifications: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    price: Mapped[float] = mapped_column(Float)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    warranty_years: Mapped[int] = mapped_column(Integer, default=0)
```

Note: `stock` (the derived status string) is deliberately NOT a column — it's
computed from `stock_qty` at read time via `derive_stock_status()` (Task 11), so
it can never drift out of sync the way a stored+derived pair can.

- [ ] **Step 2: Update `app/models/__init__.py`**

```python
from app.models.base import Base
from app.models.catalog import Brand, Category, Product
from app.models.employee import DailyReport, Employee, LeaveRequest, Task

__all__ = [
    "Base",
    "Employee",
    "Task",
    "LeaveRequest",
    "DailyReport",
    "Category",
    "Brand",
    "Product",
]
```

- [ ] **Step 3: Create `app/schemas/catalog.py`**

```python
from pydantic import BaseModel


class CategoryOut(BaseModel):
    model_config = {"from_attributes": True}
    slug: str
    name: str
    icon_url: str
    product_count: int


class BrandOut(BaseModel):
    model_config = {"from_attributes": True}
    slug: str
    name: str
    logo_url: str
```

- [ ] **Step 4: Write the failing test**

Create `Allaince-backend/tests/services/test_catalog_categories.py`:
```python
from app.db import async_session_factory, init_models
from app.services.catalog import (
    create_category,
    list_categories,
    slugify,
    unique_slug,
)


def test_slugify_lowercases_and_hyphenates():
    assert slugify("PLCs & Machine Control") == "plcs-machine-control"
    assert slugify("  Leading/Trailing  ") == "leading-trailing"


def test_unique_slug_appends_numeric_suffix_on_collision():
    existing = {"drives", "drives-2"}
    assert unique_slug("drives", existing) == "drives-3"
    assert unique_slug("sensors", existing) == "sensors"


async def test_create_and_list_categories():
    await init_models()
    async with async_session_factory() as session:
        await create_category(session, name="Drives", icon_url="/icons/drives.svg")
        categories = await list_categories(session)
        assert len(categories) == 1
        assert categories[0].slug == "drives"
        assert categories[0].product_count == 0
```

- [ ] **Step 5: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/services/test_catalog_categories.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.catalog'`

- [ ] **Step 6: Create `app/services/catalog.py`**

```python
import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Brand, Category, Product


def slugify(name: str) -> str:
    lowered = name.lower().strip()
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)
    return hyphenated.strip("-")


def unique_slug(base: str, existing: set[str]) -> str:
    candidate = base
    n = 2
    while candidate in existing:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


async def list_categories(db: AsyncSession) -> list[Category]:
    result = await db.execute(select(Category))
    return list(result.scalars().all())


async def create_category(db: AsyncSession, name: str, icon_url: str) -> Category:
    existing = {c.slug for c in await list_categories(db)}
    base = slugify(name)
    slug = unique_slug(base, existing)
    category = Category(slug=slug, name=name, icon_url=icon_url, product_count=0)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def sync_category_product_counts(db: AsyncSession) -> None:
    counts_result = await db.execute(
        select(Product.category_slug, func.count(Product.slug)).group_by(
            Product.category_slug
        )
    )
    counts = dict(counts_result.all())
    categories = await list_categories(db)
    changed = False
    for category in categories:
        actual = counts.get(category.slug, 0)
        if category.product_count != actual:
            category.product_count = actual
            changed = True
    if changed:
        await db.commit()
```

- [ ] **Step 7: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/services/test_catalog_categories.py -v`
Expected: `3 passed`

- [ ] **Step 8: Commit**

```bash
git add Allaince-backend/app/models/catalog.py Allaince-backend/app/models/__init__.py Allaince-backend/app/schemas/catalog.py Allaince-backend/app/services/catalog.py Allaince-backend/tests/services/test_catalog_categories.py
git commit -m "feat: add Category/Brand/Product models and category service"
```

### Task 11: Product service (CRUD, stock, bulk import)

**Files:**
- Modify: `Allaince-backend/app/schemas/catalog.py` (add product schemas)
- Modify: `Allaince-backend/app/services/catalog.py` (add product functions)
- Test: `Allaince-backend/tests/services/test_catalog_products.py`

**Interfaces:**
- Consumes: `sync_category_product_counts`, `slugify`, `unique_slug` (Task 10)
- Produces: `ProductCreate`, `ProductOut`, `derive_stock_status(qty: int) ->
  str` (thresholds from Global Constraints), `default_stock_qty_for_status(status:
  str) -> int`, `list_products(db, *, category=None, brand=None, q=None,
  in_stock=None, page=1, page_size=24) -> tuple[list[Product], int]` (items,
  total count — for pagination), `get_product(db, slug) -> Product | None`,
  `create_product(db, data: ProductCreate) -> Product`, `update_product_stock(db,
  slug, qty: int) -> Product` (raises `ValueError` if product not found or
  resulting qty negative).

- [ ] **Step 1: Append to `app/schemas/catalog.py`**

```python
from pydantic import Field


class ProductCreate(BaseModel):
    part_number: str = Field(min_length=1)
    name: str = Field(min_length=1)
    brand_slug: str
    category_slug: str
    image_url: str
    gallery: list[str] = Field(default_factory=list)
    short_specs: list[str] = Field(default_factory=list)
    description: list[str] = Field(default_factory=list)
    alternate_part_numbers: list[str] = Field(default_factory=list)
    specifications: dict[str, str] = Field(default_factory=dict)
    price: float
    stock_qty: int = 0
    warranty_years: int = 0


class ProductOut(BaseModel):
    model_config = {"from_attributes": True}
    slug: str
    part_number: str
    name: str
    brand_slug: str
    category_slug: str
    image_url: str
    gallery: list[str]
    short_specs: list[str]
    description: list[str]
    alternate_part_numbers: list[str]
    specifications: dict[str, str]
    price: float
    stock_qty: int
    stock: str
    warranty_years: int
```

- [ ] **Step 2: Write the failing test**

Create `Allaince-backend/tests/services/test_catalog_products.py`:
```python
from app.db import async_session_factory, init_models
from app.schemas.catalog import ProductCreate
from app.services.catalog import (
    create_category,
    create_product,
    default_stock_qty_for_status,
    derive_stock_status,
    get_product,
    list_products,
    update_product_stock,
)
from app.services import employees as _unused  # noqa: F401 ensures models package loaded


def test_derive_stock_status_thresholds():
    assert derive_stock_status(0) == "out-of-stock"
    assert derive_stock_status(-3) == "out-of-stock"
    assert derive_stock_status(9) == "low-stock"
    assert derive_stock_status(10) == "in-stock"
    assert derive_stock_status(500) == "in-stock"


def test_default_stock_qty_for_status():
    assert default_stock_qty_for_status("in-stock") == 50
    assert default_stock_qty_for_status("low-stock") == 5
    assert default_stock_qty_for_status("out-of-stock") == 0


async def _seed_category_and_brand(session):
    from app.models.catalog import Brand

    await create_category(session, name="Drives", icon_url="")
    session.add(Brand(slug="allen-bradley", name="Allen-Bradley", logo_url=""))
    await session.commit()


async def test_create_product_and_recompute_category_count():
    await init_models()
    async with async_session_factory() as session:
        await _seed_category_and_brand(session)
        product = await create_product(
            session,
            ProductCreate(
                part_number="1756-L61",
                name="ControlLogix 5561",
                brand_slug="allen-bradley",
                category_slug="drives",
                image_url="https://example.com/img.jpg",
                price=420900,
                stock_qty=3,
            ),
        )
        assert product.slug == "controllogix-5561"

        from app.services.catalog import list_categories

        categories = await list_categories(session)
        assert categories[0].product_count == 1


async def test_update_product_stock_derives_status():
    await init_models()
    async with async_session_factory() as session:
        await _seed_category_and_brand(session)
        product = await create_product(
            session,
            ProductCreate(
                part_number="X",
                name="X Widget",
                brand_slug="allen-bradley",
                category_slug="drives",
                image_url="",
                price=1,
                stock_qty=50,
            ),
        )
        updated = await update_product_stock(session, product.slug, 0)
        assert updated.stock_qty == 0


async def test_list_products_pagination_and_filters():
    await init_models()
    async with async_session_factory() as session:
        await _seed_category_and_brand(session)
        for i in range(3):
            await create_product(
                session,
                ProductCreate(
                    part_number=f"P{i}",
                    name=f"Widget {i}",
                    brand_slug="allen-bradley",
                    category_slug="drives",
                    image_url="",
                    price=10,
                    stock_qty=10,
                ),
            )
        items, total = await list_products(session, page=1, page_size=2)
        assert total == 3
        assert len(items) == 2

        items, total = await list_products(session, q="Widget 1")
        assert total == 1
        assert items[0].name == "Widget 1"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/services/test_catalog_products.py -v`
Expected: FAIL with `ImportError` (functions don't exist yet)

- [ ] **Step 4: Append to `app/services/catalog.py`**

```python
from app.schemas.catalog import ProductCreate


def derive_stock_status(qty: int) -> str:
    if qty <= 0:
        return "out-of-stock"
    if qty < 10:
        return "low-stock"
    return "in-stock"


def default_stock_qty_for_status(status: str) -> int:
    if status == "in-stock":
        return 50
    if status == "low-stock":
        return 5
    return 0


async def list_all_products(db: AsyncSession) -> list[Product]:
    result = await db.execute(select(Product))
    return list(result.scalars().all())


async def get_product(db: AsyncSession, slug: str) -> Product | None:
    return await db.get(Product, slug)


async def create_product(db: AsyncSession, data: ProductCreate) -> Product:
    existing = {p.slug for p in await list_all_products(db)}
    base = slugify(data.name)
    slug = unique_slug(base, existing)
    product = Product(
        slug=slug,
        part_number=data.part_number,
        name=data.name,
        brand_slug=data.brand_slug,
        category_slug=data.category_slug,
        image_url=data.image_url,
        gallery=data.gallery,
        short_specs=data.short_specs,
        description=data.description,
        alternate_part_numbers=data.alternate_part_numbers,
        specifications=data.specifications,
        price=data.price,
        stock_qty=data.stock_qty,
        warranty_years=data.warranty_years,
    )
    db.add(product)
    await db.commit()
    await sync_category_product_counts(db)
    await db.refresh(product)
    return product


async def update_product_stock(db: AsyncSession, slug: str, stock_qty: int) -> Product:
    product = await db.get(Product, slug)
    if product is None:
        raise ValueError(f"Product not found: {slug}")
    if stock_qty < 0:
        raise ValueError("Stock quantity cannot be negative")
    product.stock_qty = stock_qty
    await db.commit()
    await db.refresh(product)
    return product


async def list_products(
    db: AsyncSession,
    *,
    category: str | None = None,
    brand: str | None = None,
    q: str | None = None,
    in_stock: bool | None = None,
    page: int = 1,
    page_size: int = 24,
) -> tuple[list[Product], int]:
    stmt = select(Product)
    if category:
        stmt = stmt.where(Product.category_slug == category)
    if brand:
        stmt = stmt.where(Product.brand_slug == brand)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Product.name).like(like))
    if in_stock is True:
        stmt = stmt.where(Product.stock_qty > 0)
    elif in_stock is False:
        stmt = stmt.where(Product.stock_qty <= 0)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = list((await db.execute(stmt)).scalars().all())
    return items, total
```

Note: `ProductOut.stock` (the derived status string) is computed by the router
when serializing, not stored on the model — see Task 12.

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/services/test_catalog_products.py -v`
Expected: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add Allaince-backend/app/schemas/catalog.py Allaince-backend/app/services/catalog.py Allaince-backend/tests/services/test_catalog_products.py
git commit -m "feat: add product service with stock derivation, pagination, and filters"
```

### Task 12: Public catalog router + admin catalog router (incl. image upload, bulk import)

**Files:**
- Create: `Allaince-backend/app/routers/catalog_public.py`
- Create: `Allaince-backend/app/routers/catalog_admin.py`
- Modify: `Allaince-backend/app/main.py`
- Test: `Allaince-backend/tests/routers/test_catalog_public.py`
- Test: `Allaince-backend/tests/routers/test_catalog_admin.py`

**Interfaces:**
- Consumes: everything from Tasks 9-11, `require_admin_session` (Task 8)
- Produces: `GET /api/products`, `GET /api/products/{slug}`, `GET
  /api/categories`, `POST /api/admin/products` (multipart), `POST
  /api/admin/products/{slug}/stock`, `POST /api/admin/products/bulk`, `POST
  /api/admin/categories` (multipart).

- [ ] **Step 1: Create a shared serializer helper — append to
  `app/schemas/catalog.py`**

```python
def product_to_out(product: "Product") -> ProductOut:
    from app.services.catalog import derive_stock_status

    return ProductOut(
        slug=product.slug,
        part_number=product.part_number,
        name=product.name,
        brand_slug=product.brand_slug,
        category_slug=product.category_slug,
        image_url=product.image_url,
        gallery=product.gallery,
        short_specs=product.short_specs,
        description=product.description,
        alternate_part_numbers=product.alternate_part_numbers,
        specifications=product.specifications,
        price=product.price,
        stock_qty=product.stock_qty,
        stock=derive_stock_status(product.stock_qty),
        warranty_years=product.warranty_years,
    )
```

Add `from app.models.catalog import Product` to the imports at the top of
`app/schemas/catalog.py` guarded with `TYPE_CHECKING` to avoid a circular import:
```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.catalog import Product
```

- [ ] **Step 2: Write the failing test for the public router**

Create `Allaince-backend/tests/routers/test_catalog_public.py`:
```python
from app.db import async_session_factory, init_models
from app.models.catalog import Brand
from app.schemas.catalog import ProductCreate
from app.services.catalog import create_category, create_product


async def _seed(session):
    await create_category(session, name="Drives", icon_url="")
    session.add(Brand(slug="siemens", name="Siemens", logo_url=""))
    await session.commit()
    await create_product(
        session,
        ProductCreate(
            part_number="6AV2123",
            name="SIMATIC KTP700",
            brand_slug="siemens",
            category_slug="drives",
            image_url="https://example.com/a.jpg",
            price=500,
            stock_qty=2,
        ),
    )


async def test_list_products_public(client):
    await init_models()
    async with async_session_factory() as session:
        await _seed(session)

    response = await client.get("/api/products")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["stock"] == "low-stock"


async def test_get_product_by_slug(client):
    await init_models()
    async with async_session_factory() as session:
        await _seed(session)

    response = await client.get("/api/products/simatic-ktp700")
    assert response.status_code == 200
    assert response.json()["name"] == "SIMATIC KTP700"


async def test_get_product_404(client):
    response = await client.get("/api/products/does-not-exist")
    assert response.status_code == 404
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/routers/test_catalog_public.py -v`
Expected: FAIL — `404 Not Found` (router not registered)

- [ ] **Step 4: Create `app/routers/catalog_public.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.catalog import CategoryOut, ProductOut, product_to_out
from app.services.catalog import get_product, list_categories, list_products

router = APIRouter(prefix="/api", tags=["catalog-public"])


@router.get("/products")
async def get_products(
    category: str | None = None,
    brand: str | None = None,
    q: str | None = None,
    in_stock: bool | None = None,
    page: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_products(
        db, category=category, brand=brand, q=q, in_stock=in_stock, page=page
    )
    return {
        "items": [product_to_out(p) for p in items],
        "total": total,
        "page": page,
    }


@router.get("/products/{slug}", response_model=ProductOut)
async def get_product_detail(slug: str, db: AsyncSession = Depends(get_db)):
    product = await get_product(db, slug)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_out(product)


@router.get("/categories", response_model=list[CategoryOut])
async def get_categories(db: AsyncSession = Depends(get_db)):
    return await list_categories(db)
```

- [ ] **Step 5: Register the router in `app/main.py`**

Add import: `from app.routers import catalog_public as catalog_public_router`
Add: `app.include_router(catalog_public_router.router)`

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/routers/test_catalog_public.py -v`
Expected: `3 passed`

- [ ] **Step 7: Write the failing test for the admin router**

Create `Allaince-backend/tests/routers/test_catalog_admin.py`:
```python
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.db import async_session_factory, init_models
from app.models.catalog import Brand
from app.schemas.session import AdminSession
from app.services.catalog import create_category


async def _admin_cookie(client, role="sub"):
    token = await create_session_token(
        AdminSession(role=role, name="Admin", email="admin@example.com")
    )
    client.cookies.set(ADMIN_SESSION_COOKIE, token)


async def test_create_product_requires_admin(client):
    response = await client.post("/api/admin/products", data={"name": "X"})
    assert response.status_code == 401


async def test_create_product_multipart(client):
    await init_models()
    async with async_session_factory() as session:
        await create_category(session, name="Drives", icon_url="")
        session.add(Brand(slug="siemens", name="Siemens", logo_url=""))
        await session.commit()

    await _admin_cookie(client)
    response = await client.post(
        "/api/admin/products",
        data={
            "part_number": "6AV2123",
            "name": "SIMATIC KTP700",
            "brand_slug": "siemens",
            "category_slug": "drives",
            "price": "500",
            "stock_qty": "10",
        },
        files={"image": ("test.jpg", b"fake-image-bytes", "image/jpeg")},
    )
    assert response.status_code == 201
    assert response.json()["slug"] == "simatic-ktp700"


async def test_update_stock(client):
    await init_models()
    async with async_session_factory() as session:
        await create_category(session, name="Drives", icon_url="")
        session.add(Brand(slug="siemens", name="Siemens", logo_url=""))
        await session.commit()

    await _admin_cookie(client)
    create_response = await client.post(
        "/api/admin/products",
        data={
            "part_number": "P1",
            "name": "Widget",
            "brand_slug": "siemens",
            "category_slug": "drives",
            "price": "10",
            "stock_qty": "10",
        },
        files={"image": ("test.jpg", b"bytes", "image/jpeg")},
    )
    slug = create_response.json()["slug"]

    stock_response = await client.post(
        f"/api/admin/products/{slug}/stock", json={"stock_qty": 0}
    )
    assert stock_response.status_code == 200
    assert stock_response.json()["stock"] == "out-of-stock"


async def test_update_stock_rejects_negative(client):
    await init_models()
    async with async_session_factory() as session:
        await create_category(session, name="Drives", icon_url="")
        session.add(Brand(slug="siemens", name="Siemens", logo_url=""))
        await session.commit()

    await _admin_cookie(client)
    create_response = await client.post(
        "/api/admin/products",
        data={
            "part_number": "P2",
            "name": "Gadget",
            "brand_slug": "siemens",
            "category_slug": "drives",
            "price": "10",
            "stock_qty": "10",
        },
        files={"image": ("test.jpg", b"bytes", "image/jpeg")},
    )
    slug = create_response.json()["slug"]

    stock_response = await client.post(
        f"/api/admin/products/{slug}/stock", json={"stock_qty": -5}
    )
    assert stock_response.status_code == 400
```

- [ ] **Step 8: Run test to verify it fails**

Run: `.venv/Scripts/pytest tests/routers/test_catalog_admin.py -v`
Expected: FAIL — `404 Not Found`

- [ ] **Step 9: Create `app/routers/catalog_admin.py`**

```python
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_admin_session
from app.db import get_db
from app.integrations.object_storage import upload_image
from app.schemas.catalog import ProductCreate, ProductOut, product_to_out
from app.schemas.session import AdminSession
from app.services.catalog import (
    create_category,
    create_product,
    slugify,
    update_product_stock,
)

router = APIRouter(prefix="/api/admin", tags=["catalog-admin"])


@router.post("/products", response_model=ProductOut, status_code=201)
async def admin_create_product(
    part_number: str = Form(...),
    name: str = Form(...),
    brand_slug: str = Form(...),
    category_slug: str = Form(...),
    price: float = Form(...),
    stock_qty: int = Form(0),
    warranty_years: int = Form(0),
    image: UploadFile = File(...),
    session: AdminSession = Depends(require_admin_session),
    db: AsyncSession = Depends(get_db),
):
    image_bytes = await image.read()
    image_url = await upload_image(
        f"images/products/{category_slug}/{image.filename}",
        image_bytes,
        image.content_type or "image/jpeg",
    )
    product = await create_product(
        db,
        ProductCreate(
            part_number=part_number,
            name=name,
            brand_slug=brand_slug,
            category_slug=category_slug,
            image_url=image_url,
            price=price,
            stock_qty=stock_qty,
            warranty_years=warranty_years,
        ),
    )
    return product_to_out(product)


class StockUpdate(BaseModel):
    stock_qty: int


@router.post("/products/{slug}/stock", response_model=ProductOut)
async def admin_update_stock(
    slug: str,
    payload: StockUpdate,
    session: AdminSession = Depends(require_admin_session),
    db: AsyncSession = Depends(get_db),
):
    try:
        product = await update_product_stock(db, slug, payload.stock_qty)
    except ValueError as exc:
        message = str(exc)
        status = 404 if "not found" in message else 400
        raise HTTPException(status_code=status, detail=message) from exc
    return product_to_out(product)


@router.post("/categories")
async def admin_create_category(
    name: str = Form(...),
    icon: UploadFile | None = File(default=None),
    session: AdminSession = Depends(require_admin_session),
    db: AsyncSession = Depends(get_db),
):
    icon_url = ""
    if icon is not None:
        icon_bytes = await icon.read()
        icon_url = await upload_image(
            f"images/categories/{slugify(name)}{_ext(icon.filename)}",
            icon_bytes,
            icon.content_type or "image/svg+xml",
        )
    category = await create_category(db, name=name, icon_url=icon_url)
    return {"slug": category.slug, "name": category.name, "icon_url": category.icon_url}


def _ext(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ".svg"
    return "." + filename.rsplit(".", 1)[-1]
```

- [ ] **Step 10: Register the router in `app/main.py`**

Add import: `from app.routers import catalog_admin as catalog_admin_router`
Add: `app.include_router(catalog_admin_router.router)`

- [ ] **Step 11: Run test to verify it passes**

Run: `.venv/Scripts/pytest tests/routers/test_catalog_admin.py -v`
Expected: `4 passed`

- [ ] **Step 12: Run the full test suite so far**

Run: `.venv/Scripts/pytest -v`
Expected: all tests across all files pass.

- [ ] **Step 13: Commit**

```bash
git add Allaince-backend/app/routers/catalog_public.py Allaince-backend/app/routers/catalog_admin.py Allaince-backend/app/schemas/catalog.py Allaince-backend/app/main.py Allaince-backend/tests/routers/test_catalog_public.py Allaince-backend/tests/routers/test_catalog_admin.py
git commit -m "feat: add public and admin catalog routers with image upload"
```

**Note for later tasks**: Task 13 (bulk import) and hero-images upload follow the
identical multipart-upload + service-call pattern established here and are
detailed in Phase 3b below along with the brand-seeding admin endpoint.

---

## Phases 4-9: Remaining Subsystems

Phases 1-3 above are fully detailed (exact code, exact tests, exact commit
boundaries) and establish the pattern every remaining subsystem follows:
model → Pydantic schema → service function → router endpoint → test, in that
order, TDD throughout. Rather than duplicate that same density for another
~5000 lines before writing any more code, the remaining phases are implemented
directly against the approved design spec
(`docs/superpowers/specs/2026-08-19-standalone-fastapi-backend-design.md`) and
this plan's **Global Constraints** section, using the identical pattern:

- **Phase 4 — Quotations, Orders, Order Confirmations, Contact Requests**:
  `quotations`, `orders`, `order_confirmations` (1:1 split table), `contact_requests`
  tables; service functions mirroring `admin-operations.ts` exactly (`add_quotation`,
  `update_quotation_status` with confirmation-retraction-on-status-change,
  `confirm_quotation`, `next_confirmation_sequence`, `find_by_tracking_id`,
  `update_delivery_stage`, `add_order`, `update_order_status`,
  `add_contact_request`, `mark_contact_request_handled`); public routes
  (`POST /api/quotations`, `GET /api/quotations/{id}`, `POST /api/contact`,
  `GET /api/track/{tracking_id}`) and admin routes (`PATCH .../status`,
  `POST .../confirm`, `PATCH .../delivery`, `PATCH .../handled`) with the same
  three-tier RBAC as Phase 2.
- **Phase 5 — Analytics + Search**: `read_range_analytics(db, range)` ported from
  `admin-analytics.ts`'s exact bucketing/windowing/delta algorithm (rolling
  windows, `null` delta with no baseline, cancelled orders excluded from revenue);
  top-sellers computed from `order_confirmations.lines` aggregation (real data,
  not mock, per the approved design); `search_admin(db, query, session)` mirroring
  `admin-search.ts`'s RBAC-scoped unified search with per-type caps.
- **Phase 6 — Tasks, Leave Requests, Daily Reports routers**: routers over the
  Task 5/6 models and service layer, with per-resource ownership checks (a
  sub-admin may only update their own task/leave/report, checked by comparing
  `session.employee_id` to the resource's owning employee ID — not by role alone).
- **Phase 7 — Integrations**: Gmail OAuth (`google-auth-oauthlib`, readonly scope,
  encrypted refresh token in `gmail_token` table, AES-256-GCM at rest, decrypt
  failure treated as "not connected"); WeasyPrint-based PDF generation for the
  three document types (issued quotation, unpriced request, order invoice);
  Resend-based transactional email (quotation delivery, contact/price-request
  notifications); Redis-backed rate limiting (contact form: 5 req/10min/IP,
  quotation submission: 10 req/10min, matching current limits) with in-memory
  fallback in dev.
- **Phase 8 — Data migration**: one-time script reading `Alliance-frontend/data/*.json`
  and seeding Postgres via the service-layer functions (not raw SQL, so all
  validation/derivation logic — e.g. `derive_stock_status`, password hashing for
  the one plaintext employee password — runs during migration).
- **Phase 9 — Frontend rewiring**: remove `app/api/**` and the moved `app/lib/*`
  modules per the design spec's "Frontend changes" section; replace call sites with
  `fetch()` against the backend; simplify `proxy.ts` to an auth-presence check.

Each of these will be implemented with the same TDD discipline as Phases 1-3
(failing test → minimal implementation → passing test → commit) during execution,
even though the step-by-step prose isn't pre-written here.
