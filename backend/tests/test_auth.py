"""Auth: register, login, /auth/me, logout."""
import uuid
import pytest
from conftest import API, UA, auth_headers, TESTER1


def test_root_ok(http):
    r = http.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_register_new_user(http):
    email = f"pytest_{uuid.uuid4().hex[:8]}@belote.tn"
    username = f"Pyt{uuid.uuid4().hex[:6]}"
    r = http.post(f"{API}/auth/register",
                  json={"email": email, "password": "Belote123!", "username": username})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email
    assert data["user"]["username"] == username
    assert data["user"]["elo"] == 1000


def test_register_duplicate_email(http):
    r = http.post(f"{API}/auth/register",
                  json={"email": TESTER1["email"], "password": "Belote123!",
                        "username": f"Dup{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 400


def test_login_tester1_success(http, tester1):
    assert tester1["token"]
    assert tester1["user"]["email"] == TESTER1["email"]


def test_login_wrong_password(http):
    r = http.post(f"{API}/auth/login",
                  json={"email": TESTER1["email"], "password": "wrong-pass"})
    assert r.status_code == 401


def test_me_with_token(http, tester1):
    r = http.get(f"{API}/auth/me", headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    assert r.json()["user_id"] == tester1["user"]["user_id"]


def test_me_without_token(http):
    r = http.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_logout_and_me_invalid(http):
    # Register a throwaway user, logout, then confirm token invalid
    email = f"pytest_{uuid.uuid4().hex[:8]}@belote.tn"
    r = http.post(f"{API}/auth/register",
                  json={"email": email, "password": "Belote123!",
                        "username": f"Lg{uuid.uuid4().hex[:6]}"})
    token = r.json()["token"]
    lo = http.post(f"{API}/auth/logout", headers=auth_headers(token))
    assert lo.status_code == 200
    r2 = http.get(f"{API}/auth/me", headers=auth_headers(token))
    assert r2.status_code == 401
