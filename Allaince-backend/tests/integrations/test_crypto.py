from app.integrations.crypto import decrypt, encrypt


def test_round_trip():
    assert decrypt(encrypt("a-refresh-token")) == "a-refresh-token"


def test_ciphertext_differs_each_time():
    # A fresh nonce per encryption, so identical plaintexts do not collide.
    assert encrypt("same") != encrypt("same")


def test_decrypt_returns_none_for_tampered_ciphertext():
    token = encrypt("secret")
    assert decrypt(token[:-6] + "AAAAAA") is None


def test_decrypt_returns_none_for_garbage():
    assert decrypt("not-base64!!") is None
    assert decrypt("") is None


def test_decrypt_returns_none_after_secret_rotation(monkeypatch):
    from app.config import settings

    token = encrypt("secret")
    monkeypatch.setattr(settings, "gmail_token_encryption_secret", "a-completely-different-secret-32")
    # A rotated secret means "not connected", not a crash.
    assert decrypt(token) is None
