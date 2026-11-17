"""Regression guard: quitting an offline solo-vs-AI game must keep it resumable.

User-reported regression (twice): leaving a 1-vs-3-AI offline game used to lose
the saved game, so the Home "resume" button never appeared. The Node runner
executes the REAL frontend engine code (useLocalGame.ts via sucrase) and
asserts the full save -> quit -> resume contract.
"""
import json
import subprocess

RUNNER = "/app/backend/tests/local_resume_runner.cjs"


def test_local_solo_game_resumable_after_quit():
    res = subprocess.run(
        ["node", RUNNER], capture_output=True, text=True, timeout=90
    )
    assert res.stdout.strip(), f"no output (stderr: {res.stderr[:500]})"
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out.get("ok"), f"failed checks: {out} (stderr: {res.stderr[:500]})"
    # every individual contract point must hold
    for name, passed in out["checks"].items():
        assert passed, f"check failed: {name}"
