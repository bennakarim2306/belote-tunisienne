"""Sign in with Apple — negative-path tests (full flow needs a real device).

POST /api/auth/apple must reject garbage tokens and self-signed tokens with
401 invalid_apple_token, and never create users/sessions on failure.
"""
import os
import sys
import time

import jwt
import pytest
import requests

BASE = os.environ.get("TEST_BASE", "http://localhost:8001")


def post_apple(payload):
    return requests.post(f"{BASE}/api/auth/apple", json=payload, timeout=20)


def test_garbage_token_401():
    r = post_apple({"identity_token": "not-a-jwt"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_apple_token"


def test_hs256_forged_token_401():
    forged = jwt.encode(
        {"sub": "fake", "iss": "https://appleid.apple.com",
         "aud": "com.emergent.cardtableorient.b0nhgs",
         "exp": int(time.time()) + 600},
        "secret", algorithm="HS256")
    r = post_apple({"identity_token": forged})
    assert r.status_code == 401


def test_rs256_wrong_key_401():
    try:
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
    except ImportError:
        pytest.skip("cryptography unavailable")
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption())
    forged = jwt.encode(
        {"sub": "fake", "iss": "https://appleid.apple.com",
         "aud": "com.emergent.cardtableorient.b0nhgs",
         "exp": int(time.time()) + 600},
        pem, algorithm="RS256", headers={"kid": "nonexistent-kid"})
    r = post_apple({"identity_token": forged})
    assert r.status_code == 401


def test_missing_body_422():
    r = post_apple({})
    assert r.status_code == 422


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q"]))
