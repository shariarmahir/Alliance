import base64
import re

import bcrypt

# bcrypt hashes are self-identifying: "$2a$"/"$2b$"/"$2y$" plus cost.
_HASH_RE = re.compile(r"^\$2[aby]\$\d{2}\$")

BCRYPT_COST = 12


def is_hashed(password: str) -> bool:
    return bool(_HASH_RE.match(password))


def hash_password(plain: str) -> str:
    # bcrypt silently truncates at 72 bytes; encode first so the limit is
    # applied to bytes, not characters.
    return bcrypt.hashpw(plain.encode("utf-8")[:72], bcrypt.gensalt(BCRYPT_COST)).decode("utf-8")


def verify_password(plain: str, stored: str) -> bool:
    """Constant-time compare against a bcrypt hash.

    Unlike the frontend, plaintext stored passwords are never accepted — the
    migration hashes every legacy password on the way in, so that fallback has
    no reason to exist here.
    """
    if not stored or not is_hashed(stored):
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], stored.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def decode_bootstrap_hash(b64: str | None) -> str | None:
    """The bootstrap super-admin hash is base64-wrapped.

    Not for secrecy — a raw bcrypt string like "$2b$12$K..." gets mangled by
    env loaders that perform $VAR substitution, truncating the 60-char hash and
    rejecting every correct password. Base64 has no "$".
    """
    if not b64:
        return None
    try:
        decoded = base64.b64decode(b64, validate=True).decode("utf-8").strip()
    except (ValueError, UnicodeDecodeError):
        return None
    return decoded if is_hashed(decoded) else None
