import logging
import mimetypes
import re
import time
import unicodedata
from pathlib import Path

from app.config import settings

logger = logging.getLogger("app.storage")

# Only these ever reach the bucket — the store holds product photography and
# category icons, never documents or arbitrary uploads.
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/avif",
}
MAX_IMAGE_BYTES = 8 * 1024 * 1024

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")

# Local-disk fallback for development, so image upload works without an S3
# bucket configured.
LOCAL_MEDIA_ROOT = Path("media")


class ImageRejected(ValueError):
    """Raised when an upload fails validation — surfaced to the caller as 400."""


def safe_filename(filename: str) -> str:
    """Strips directory components and anything non-portable.

    A filename arrives from the browser, so it is attacker-controlled: without
    this, "../../etc/x.png" would escape the key prefix.
    """
    name = unicodedata.normalize("NFKD", filename or "").encode("ascii", "ignore").decode()
    name = Path(name).name  # drops any path, including Windows separators
    name = _UNSAFE.sub("-", name).strip(".-")
    return name or "upload"


def validate_image(filename: str, content: bytes, content_type: str | None) -> str:
    """Returns the validated extension, or raises ImageRejected."""
    if not content:
        raise ImageRejected("The uploaded file is empty.")
    if len(content) > MAX_IMAGE_BYTES:
        raise ImageRejected(
            f"Image exceeds the {MAX_IMAGE_BYTES // (1024 * 1024)}MB limit."
        )

    ext = Path(safe_filename(filename)).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ImageRejected(
            f"Unsupported image type '{ext or 'unknown'}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )
    # Trust the extension over the declared content type, but reject an
    # outright mismatch such as a .png declared as application/pdf.
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise ImageRejected(f"Unsupported content type '{content_type}'.")
    return ext


def _public_url(key: str) -> str:
    if settings.s3_public_base_url:
        return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
    if settings.s3_endpoint_url:
        return f"{settings.s3_endpoint_url.rstrip('/')}/{settings.s3_bucket_name}/{key}"
    return f"{settings.public_api_url.rstrip('/')}/media/{key}"


def _s3_client():
    import boto3  # imported lazily so the core API installs without boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
    )


def save_image(key: str, content: bytes, content_type: str | None = None) -> str:
    """Stores an image and returns its public URL.

    Uses S3 when configured, otherwise local disk under ./media so the admin
    catalog is fully usable in development.
    """
    guessed = content_type or mimetypes.guess_type(key)[0] or "application/octet-stream"

    if settings.s3_configured:
        try:
            _s3_client().put_object(
                Bucket=settings.s3_bucket_name,
                Key=key,
                Body=content,
                ContentType=guessed,
                CacheControl="public, max-age=31536000, immutable",
            )
            return _public_url(key)
        except Exception as exc:
            # Falling through to disk would hide a broken bucket until someone
            # noticed images vanishing on the next deploy.
            logger.exception("S3 upload failed for %s", key)
            raise ImageRejected(f"Image upload failed: {exc}") from exc

    destination = LOCAL_MEDIA_ROOT / key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return _public_url(key)


def product_image_key(category_slug: str, filename: str) -> str:
    return f"images/products/{category_slug}/{safe_filename(filename)}"


def category_icon_key(slug: str, ext: str) -> str:
    return f"images/categories/{safe_filename(slug)}{ext}"


def hero_image_key(slot: int, ext: str) -> str:
    return f"images/hero/image{int(slot)}{ext}"


def cache_busted(url: str) -> str:
    """Hero slots reuse one key per slot, so a replacement upload needs a
    distinct query string or caches keep serving the previous bytes."""
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}v={int(time.time())}"
