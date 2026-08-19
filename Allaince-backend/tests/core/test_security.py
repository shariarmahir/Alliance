import base64

from app.core.security import (
    decode_bootstrap_hash,
    hash_password,
    is_hashed,
    verify_password,
)


def test_hash_is_not_plaintext_and_verifies():
    hashed = hash_password("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert is_hashed(hashed)
    assert verify_password("correct horse battery staple", hashed)


def test_wrong_password_fails():
    assert not verify_password("wrong", hash_password("right"))


def test_hash_uses_cost_12():
    assert hash_password("x").startswith("$2b$12$")


def test_same_password_gets_distinct_salts():
    assert hash_password("same") != hash_password("same")


def test_plaintext_stored_password_is_rejected():
    # Legacy plaintext must never authenticate against this backend.
    assert not verify_password("hunter2", "hunter2")


def test_verify_handles_malformed_hash():
    assert not verify_password("x", "")
    assert not verify_password("x", "$2b$notarealhash")


def test_decode_bootstrap_hash_round_trip():
    hashed = hash_password("admin-password")
    encoded = base64.b64encode(hashed.encode()).decode()
    assert decode_bootstrap_hash(encoded) == hashed


def test_decode_bootstrap_hash_rejects_non_bcrypt_and_garbage():
    assert decode_bootstrap_hash(None) is None
    assert decode_bootstrap_hash("") is None
    assert decode_bootstrap_hash(base64.b64encode(b"just a password").decode()) is None
    assert decode_bootstrap_hash("!!!not-base64!!!") is None


def test_long_password_over_72_bytes_does_not_error():
    long_pw = "a" * 200
    hashed = hash_password(long_pw)
    assert verify_password(long_pw, hashed)
