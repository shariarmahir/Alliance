import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

NONCE_BYTES = 12


def _key() -> bytes:
    """Derives a 32-byte AES key from the configured secret.

    SHA-256 over the secret rather than using it raw, so any secret length
    produces a valid key without silently truncating it.
    """
    return hashlib.sha256(settings.gmail_token_encryption_secret.encode("utf-8")).digest()


def encrypt(plaintext: str) -> str:
    """AES-256-GCM, returned as base64(nonce || ciphertext || tag)."""
    nonce = os.urandom(NONCE_BYTES)
    ciphertext = AESGCM(_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt(token: str) -> str | None:
    """Returns None on any failure — wrong key after a secret rotation,
    tampering, or corruption.

    A rotated secret means "not connected", not a crashed admin screen, so the
    caller can prompt the operator to reconnect instead of erroring out.
    """
    try:
        raw = base64.b64decode(token)
        nonce, ciphertext = raw[:NONCE_BYTES], raw[NONCE_BYTES:]
        return AESGCM(_key()).decrypt(nonce, ciphertext, None).decode("utf-8")
    except Exception:
        return None
