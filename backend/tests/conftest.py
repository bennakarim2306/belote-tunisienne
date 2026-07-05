"""Shared fixtures for Belote Tunisienne backend tests."""
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TESTER1 = {"email": "tester1@belote.tn", "password": "Belote123!", "username": "Tester1"}
TESTER2 = {"email": "tester2@belote.tn", "password": "Belote123!", "username": "Tester2"}

# Browser-ish user agent (ingress rejects non-browser UA on WS)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")


def _ensure(session, creds):
    """Login or register a tester account, returns (token, user)."""
    r = session.post(f"{API}/auth/login",
                     json={"email": creds["email"], "password": creds["password"]},
                     headers={"User-Agent": UA}, timeout=15)
    if r.status_code == 200:
        return r.json()["token"], r.json()["user"]
    r = session.post(f"{API}/auth/register", json=creds,
                     headers={"User-Agent": UA}, timeout=15)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "User-Agent": UA})
    return s


@pytest.fixture(scope="session")
def tester1(http):
    token, user = _ensure(http, TESTER1)
    return {"token": token, "user": user}


@pytest.fixture(scope="session")
def tester2(http):
    token, user = _ensure(http, TESTER2)
    return {"token": token, "user": user}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "User-Agent": UA,
            "Content-Type": "application/json"}
