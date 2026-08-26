import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.integrations.object_storage import LOCAL_MEDIA_ROOT
from app.routers import (
    admin_catalog,
    admin_operations,
    analytics,
    auth,
    billing,
    catalog,
    emails,
    employees,
    operations,
)

logger = logging.getLogger("app")
logging.basicConfig(level=logging.INFO)


def _check_production_config() -> None:
    """Fails fast on settings that are silently insecure in production.

    Each of these looks fine locally and is a real vulnerability once
    deployed, so the app refuses to start rather than running exposed.
    """
    problems: list[str] = []

    if "*" in settings.cors_origins_list:
        # Credentialed CORS plus a wildcard origin lets any site call the API
        # with the admin's cookie attached.
        problems.append("CORS_ALLOWED_ORIGINS must list exact origins, not '*'.")

    # A wildcard is the obvious mistake; these are the quiet ones. Every
    # .env starts life pointing at localhost, and the dev entry survives into
    # production far more often than a '*' does -- at which point a page on
    # any developer's machine can call the live API with the admin's cookie.
    # A plaintext origin is the same problem via a downgrade, and is dead
    # configuration anyway once COOKIE_SECURE is on.
    for origin in settings.cors_origins_list:
        if origin == "*":
            continue
        host = origin.split("://", 1)[-1].split(":", 1)[0].lower()
        if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
            problems.append(
                f"CORS_ALLOWED_ORIGINS contains the development origin {origin!r}."
            )
        elif not origin.startswith("https://"):
            problems.append(
                f"CORS_ALLOWED_ORIGINS entry {origin!r} must use https in production."
            )
    if not settings.cookie_secure:
        problems.append("COOKIE_SECURE must be true so the session cookie requires HTTPS.")
    if settings.cookie_samesite != "none":
        # Frontend and API are different origins in production; anything
        # stricter means the cookie is never sent and login silently fails.
        logger.warning(
            "COOKIE_SAMESITE is %r; cross-origin admin sessions need 'none'.",
            settings.cookie_samesite,
        )
    if settings.database_url.startswith("sqlite"):
        problems.append("DATABASE_URL points at SQLite; production expects PostgreSQL.")

    if problems:
        raise RuntimeError("Unsafe production configuration:\n  - " + "\n  - ".join(problems))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_production:
        _check_production_config()
        if not settings.redis_url:
            # Per-worker in-memory limiting is a speed bump, not a control,
            # once there is more than one worker.
            logger.warning("REDIS_URL is not set — rate limiting is per-worker only.")
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

# save_image() in object_storage.py builds URLs like {public_api_url}/media/{key}
# whenever S3 is not configured, but nothing served that path — every
# dashboard-uploaded image (products, category icons, hero slots) 404'd
# regardless of whether the file was actually written to disk. This mount is
# what makes the local-disk fallback usable at all; it is a no-op once S3 is
# configured, since save_image never builds a /media URL in that case.
#
# mkdir before mounting: StaticFiles raises at import time if the directory
# does not exist yet, which is the state on a brand new deploy before any
# upload has happened.
LOCAL_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(LOCAL_MEDIA_ROOT)), name="media")


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
app.include_router(billing.router)
app.include_router(employees.router)
app.include_router(analytics.router)
app.include_router(emails.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
