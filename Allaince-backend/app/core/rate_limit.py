import logging
import time
from dataclasses import dataclass

from fastapi import Request

from app.config import settings

logger = logging.getLogger("app.rate_limit")

# Redis is optional at import time so the core API installs without it; when
# REDIS_URL is set we use it, otherwise we degrade to the in-memory limiter.
try:  # pragma: no cover - import-time branch
    from redis.asyncio import Redis

    _redis_available = True
except ImportError:  # pragma: no cover
    Redis = None  # type: ignore[assignment]
    _redis_available = False

_redis_client = None
_redis_failed = False


@dataclass
class RateLimitResult:
    ok: bool
    remaining: int
    retry_after_seconds: int


# --- in-memory fallback -----------------------------------------------------
# Per-worker, so it is a speed bump rather than a guarantee: a request landing
# on another worker starts with a fresh counter. Adequate for dev; production
# is expected to set REDIS_URL.
_buckets: dict[str, tuple[int, float]] = {}
MAX_KEYS = 10_000


def _sweep(now: float) -> None:
    for key, (_, reset_at) in list(_buckets.items()):
        if reset_at <= now:
            del _buckets[key]
    if len(_buckets) > MAX_KEYS:
        for key in list(_buckets)[: len(_buckets) - MAX_KEYS]:
            del _buckets[key]


def _check_in_memory(key: str, limit: int, window_seconds: int) -> RateLimitResult:
    now = time.time()
    if len(_buckets) > MAX_KEYS:
        _sweep(now)

    entry = _buckets.get(key)
    if entry is None or entry[1] <= now:
        _buckets[key] = (1, now + window_seconds)
        return RateLimitResult(True, limit - 1, 0)

    count, reset_at = entry
    count += 1
    _buckets[key] = (count, reset_at)
    if count > limit:
        return RateLimitResult(False, 0, max(1, int(reset_at - now) + 1))
    return RateLimitResult(True, limit - count, 0)


async def _get_redis():
    global _redis_client, _redis_failed
    if _redis_failed or not settings.redis_url or not _redis_available:
        return None
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def check_rate_limit(key: str, limit: int, window_seconds: int) -> RateLimitResult:
    """Fixed-window limiter. Redis-backed when configured, in-memory otherwise.

    A Redis outage fails open rather than locking every customer out of the
    contact form — availability matters more than the speed bump here.
    """
    global _redis_failed
    redis = await _get_redis()
    if redis is not None:
        try:
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            count, ttl = await pipe.execute()
            if ttl < 0:
                await redis.expire(key, window_seconds)
                ttl = window_seconds
            if count > limit:
                return RateLimitResult(False, 0, max(1, int(ttl)))
            return RateLimitResult(True, limit - int(count), 0)
        except Exception as exc:  # pragma: no cover - network failure path
            logger.warning("Rate limiter falling back to memory: %s", exc)
            _redis_failed = True

    return _check_in_memory(key, limit, window_seconds)


def client_key(request: Request, prefix: str) -> str:
    """Best-effort client identity.

    x-forwarded-for is trustworthy only behind a proxy that overwrites it;
    reached directly it is attacker-controlled, which is part of why this is
    a speed bump and not an access control.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"ratelimit:{prefix}:{ip}"


def reset_in_memory_buckets() -> None:
    """Test helper — keeps one test's throttling out of the next one."""
    _buckets.clear()
