"""Helper for iteration 32 FE test: create/cleanup a TEST_ friend request to tester1."""
import sys
import uuid

import requests

from conftest import API, UA, TESTER1, auth_headers

H = {"User-Agent": UA}
t1 = requests.post(f"{API}/auth/login", json={"email": TESTER1["email"],
                   "password": TESTER1["password"]}, headers=H).json()
if sys.argv[1] == "create":
    s = uuid.uuid4().hex[:6]
    u = requests.post(f"{API}/auth/register", json={
        "email": f"test_fe_{s}@belote.tn", "password": "Test1234!",
        "username": f"TEST_fe{s}"}, headers=H).json()
    r = requests.post(f"{API}/friends/request", json={"user_id": t1["user"]["user_id"]},
                      headers=auth_headers(u["token"]))
    print("request:", r.status_code, "requester:", u["user"]["user_id"])
    print("tester1 games/current:", requests.get(f"{API}/games/current",
          headers=auth_headers(t1["token"])).json())
else:
    req_uid = sys.argv[2]
    n = requests.get(f"{API}/notifications", headers=auth_headers(t1["token"])).json()
    for fr in n["friend_requests"]:
        if fr["user_id"] == req_uid:
            r = requests.post(f"{API}/friends/respond", json={
                "friendship_id": fr["friendship_id"], "accept": False},
                headers=auth_headers(t1["token"]))
            print("declined", fr["friendship_id"], r.status_code)
