# WeasyPrint needs a native GTK/Pango/Cairo stack, which is why this is a
# Debian slim image rather than Alpine — musl builds of those libraries are a
# recurring source of subtle text-rendering breakage.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libharfbuzz0b \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu-core \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir ".[integrations]"

COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts

# Run as a non-root user: a container process that never needs to write to the
# image should not be able to.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/media \
    && chown -R appuser:appuser /app
USER appuser

# Most PaaS hosts (Render, Railway, Fly, Cloud Run) assign the port at runtime
# through $PORT and route to that; a hardcoded port fails their health check.
# 8000 is only the local-compose default.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

# Migrations run at startup so a fresh deploy converges on the current schema.
# WEB_CONCURRENCY lets a small instance drop to 1-2 workers; 4 would exhaust
# memory on a 512MB free tier, and each worker holds its own DB pool.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY:-4} --proxy-headers --forwarded-allow-ips='*'"]
