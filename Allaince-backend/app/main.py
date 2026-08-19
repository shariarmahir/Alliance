import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import (
    admin_catalog,
    admin_operations,
    analytics,
    auth,
    catalog,
    emails,
    employees,
    operations,
)

logger = logging.getLogger("app")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_production and not settings.redis_url:
        # Stated as a hard requirement in the design: per-worker in-memory
        # limiting is a speed bump, not a control, once there are many workers.
        logger.warning("REDIS_URL is not set in production — rate limiting is per-worker only.")
    yield


app = FastAPI(
    title="AutoLink Integrated Technologies API",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive docs are useful in dev but enumerate every admin route in prod.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Frontend forms expect { error } — mirror that shape rather than FastAPI's
    # default { detail: [...] }, and keep the field breakdown alongside it.
    #
    # errors() carries the original exception object for custom validators,
    # which json cannot encode; keep only the serialisable fields.
    details = [
        {
            "loc": [str(part) for part in error.get("loc", ())],
            "msg": str(error.get("msg", "")),
            "type": str(error.get("type", "")),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"error": "Invalid request body.", "details": details},
    )


app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(admin_catalog.router)
app.include_router(operations.router)
app.include_router(admin_operations.router)
app.include_router(employees.router)
app.include_router(analytics.router)
app.include_router(emails.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
