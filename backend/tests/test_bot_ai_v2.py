"""Bot AI v2 — the 8 behaviour scenarios of the approved plan, each asserted
on the Python engine AND replayed identically on the TypeScript engine
(frontend/src/game/ai.ts) through tests/parity_runner.cjs: both engines must
take exactly the same decisions on the same deals (strict parity rule).

Scenarios:
 1. Keep drawing trump while opponents may still hold some (team contract).
 1b. Stop drawing once all trumps are out; cash the side master instead.
 2. Weak at trump but partner announced strong: open a small trump.
 3. Partner estimation never cheats: I hold J+9 myself -> partner strength
    falls back to 1 and I draw with my own master instead.
 4. Capot potential ON: trump masters + covered suits, opponents 0 tricks.
 5. Capot extinction: the moment opponents take one trick, capot is off.
 6. Colour master vs SURE master: a known cutter voids the suit.
 7. Endgame (2 cards): keep the trump master for the LAST trick (+10).
 8. Endgame (2 cards): lead the trump master FIRST to drain the last
    opponent trump, then cash the freed side master.
"""
import json
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bot_ai  # noqa: E402

HERE = os.path.dirname(__file__)


def _t(seat, card):
    return {"seat": seat, "card": card}


SCENARIOS = {
    # 1 — team 0 owns contract (S), I (seat 0) hold J+9 of trump, one round
    # of trumps went out, opponents may still hold some -> keep pulling JS.
    "s1_keep_drawing": {
        "seat": 0, "trump": "S", "bid_team": 0, "trick": [],
        "hand": ["JS", "9S", "AH", "KH", "7D", "8D", "7C"],
        "history": [_t(0, "AS"), _t(1, "7S"), _t(2, "8S"), _t(3, "QS")],
        "bids": [{"seat": 0, "type": "bid", "value": 100, "suit": "S"}],
    },
    # 1b — all 8 trumps are out: stop drawing, cash the side master (AH).
    "s1b_stop_drawing": {
        "seat": 0, "trump": "S", "bid_team": 0, "trick": [],
        "hand": ["AH", "KH", "7D", "8D", "7C", "8C"],
        "history": [
            _t(0, "AS"), _t(1, "7S"), _t(2, "8S"), _t(3, "QS"),
            _t(0, "JS"), _t(1, "10S"), _t(2, "KS"), _t(3, "9S"),
        ],
        "bids": [{"seat": 0, "type": "bid", "value": 100, "suit": "S"}],
    },
    # 2 — partner (seat 2) bid 100 Hearts, J/9 of trump are free: open a
    # small trump toward them even though I'm weak at trump.
    "s2_weak_open_to_partner": {
        "seat": 0, "trump": "H", "bid_team": 0, "trick": [],
        "hand": ["7H", "8H", "AD", "KD", "7C", "8C", "QS", "7S"],
        "history": [],
        "bids": [{"seat": 2, "type": "bid", "value": 100, "suit": "H"}],
    },
    # 3 — same auction but I hold J+9 of trump MYSELF: the estimate must
    # exclude them (partner strength 1, their force is elsewhere) and I draw
    # with my own master instead of 'opening small'.
    "s3_no_cheating_estimate": {
        "seat": 0, "trump": "H", "bid_team": 0, "trick": [],
        "hand": ["JH", "9H", "7H", "AD", "KD", "7C", "8C", "7S"],
        "history": [],
        "bids": [{"seat": 2, "type": "bid", "value": 110, "suit": "H"}],
    },
    # 4 — trump masters + both side suits headed by aces: capot plausible,
    # secure the trick by pulling the trump master.
    "s4_capot_on": {
        "seat": 0, "trump": "S", "bid_team": 0, "trick": [],
        "hand": ["JS", "9S", "AS", "AH", "10H", "KH", "AD", "10D"],
        "history": [],
        "bids": [{"seat": 0, "type": "bid", "value": 110, "suit": "S"}],
    },
    # 5 — identical strength but the OPPONENTS already took a trick (seat 1
    # won with the ace of clubs): capot must be OFF immediately.
    "s5_capot_extinct": {
        "seat": 0, "trump": "S", "bid_team": 0, "trick": [],
        "hand": ["JS", "9S", "AS", "AH", "10H", "KH", "AD"],
        "history": [_t(0, "KC"), _t(1, "AC"), _t(2, "7C"), _t(3, "8C")],
        "bids": [{"seat": 0, "type": "bid", "value": 110, "suit": "S"}],
    },
    # 6 — AH is master of hearts but seat 1 is a KNOWN cutter (void in
    # hearts, already ruffed) and trumps remain: master yes, SURE master no.
    "s6_sure_vs_colour_master": {
        "seat": 0, "trump": "S", "bid_team": 1, "trick": [],
        "hand": ["AH", "KD", "7D", "8C"],
        "history": [_t(0, "KH"), _t(1, "7S"), _t(2, "7H"), _t(3, "8H")],
        "bids": [],
    },
    # 7 — two cards left: JS (trump master) + 7H (loser). Leading 7H first
    # keeps the trump master for the LAST trick (+10 dix de der).
    "s7_keep_trump_for_last": {
        "seat": 0, "trump": "S", "bid_team": 0, "trick": [],
        "hand": ["JS", "7H"],
        "history": [],
        "bids": [],
    },
    # 8 — two cards left: JS (trump master) + AH (master but a known cutter
    # still holds the LAST trump): lead JS FIRST to drain it, then AH is
    # unbeatable. 6 trumps out, seat 1 void in hearts and not void in trump.
    "s8_drain_then_cash": {
        "seat": 0, "trump": "S", "bid_team": 0, "trick": [],
        "hand": ["JS", "AH"],
        "history": [
            _t(2, "9S"), _t(3, "7S"), _t(0, "8S"), _t(1, "10S"),
            _t(2, "KH"), _t(3, "7H"), _t(0, "8H"), _t(1, "QS"),
            _t(2, "AD"), _t(3, "KS"), _t(0, "8D"), _t(1, "QD"),
        ],
        "bids": [],
    },
    # 9 — same auction as s2 but the partner publicly showed a trump VOID
    # (didn't follow a heart lead): estimate must fall to 0 and the bot must
    # NOT open a small trump toward an empty partner.
    "s9_partner_shown_void": {
        "seat": 0, "trump": "H", "bid_team": 0, "trick": [],
        "hand": ["7H", "8H", "AD", "KD", "7C", "8C", "QS"],
        "history": [_t(1, "KH"), _t(2, "7D"), _t(3, "9H"), _t(0, "10H")],
        "bids": [{"seat": 2, "type": "bid", "value": 100, "suit": "H"}],
    },
}


def _py_result(sc):
    mem = bot_ai.build_memory(sc["history"], sc["trick"], sc["trump"])
    res = {
        "play": bot_ai.bot_play(sc["hand"], sc["trick"], sc["trump"],
                                sc["seat"], sc["history"],
                                sc.get("bid_team"), sc.get("bids")),
        "partner_strength": bot_ai.partner_strength(
            sc.get("bids"), sc["seat"], sc["trump"], sc["hand"], mem),
        "capot": bot_ai.capot_potential(sc["hand"], mem, sc["trump"],
                                        sc["seat"], sc.get("bids"),
                                        sc["history"]),
        "sure": {c: [bot_ai.is_master(c, sc["hand"], mem, sc["trump"]),
                     bot_ai.is_sure_master(c, sc["hand"], mem, sc["trump"],
                                           sc["seat"])]
                 for c in sc["hand"]},
        "trumps_left": bot_ai.trumps_left(mem, sc["hand"], sc["trump"]),
        "control": bot_ai.team_trump_control(sc["hand"], mem, sc["trump"],
                                             sc["seat"], sc.get("bids")),
    }
    return res


PY = {name: _py_result(sc) for name, sc in SCENARIOS.items()}


# ---------------- behaviour assertions (Python engine) ----------------

def test_s1_keep_drawing_trump():
    assert PY["s1_keep_drawing"]["play"] == "JS"
    assert PY["s1_keep_drawing"]["control"] is True


def test_s1b_stop_drawing_cash_master():
    assert PY["s1b_stop_drawing"]["trumps_left"] == 0
    assert PY["s1b_stop_drawing"]["play"] == "AH"
    # with every trump gone the heart master is now a SURE master
    assert PY["s1b_stop_drawing"]["sure"]["AH"] == [True, True]


def test_s2_weak_trump_open_toward_strong_partner():
    assert PY["s2_weak_open_to_partner"]["partner_strength"] >= 2
    assert PY["s2_weak_open_to_partner"]["play"] == "7H"


def test_s3_partner_estimate_never_cheats():
    # I hold J+9 of trump myself: the partner cannot have them
    assert PY["s3_no_cheating_estimate"]["partner_strength"] == 1
    # so I draw with my own master instead of opening small
    assert PY["s3_no_cheating_estimate"]["play"] == "JH"


def test_s4_capot_potential_on():
    assert PY["s4_capot_on"]["capot"] is True
    assert PY["s4_capot_on"]["play"] == "JS"  # secure: pull the trump master


def test_s5_capot_dies_when_opponents_take_a_trick():
    assert PY["s5_capot_extinct"]["capot"] is False


def test_s6_colour_master_vs_sure_master():
    master, sure = PY["s6_sure_vs_colour_master"]["sure"]["AH"]
    assert master is True
    assert sure is False  # seat 1 is a known cutter and trumps remain


def test_s7_keep_trump_master_for_last_trick():
    assert PY["s7_keep_trump_for_last"]["play"] == "7H"


def test_s8_drain_last_trump_then_cash():
    assert PY["s8_drain_then_cash"]["trumps_left"] == 1
    assert PY["s8_drain_then_cash"]["play"] == "JS"


def test_s9_partner_shown_void_kills_estimate():
    # the partner didn't follow a heart lead: they have NO trump
    assert PY["s9_partner_shown_void"]["partner_strength"] == 0
    assert PY["s9_partner_shown_void"]["control"] is False
    # so no small-trump opening toward an empty partner
    assert PY["s9_partner_shown_void"]["play"] not in ("7H", "8H")


# ---------------- strict Python/TypeScript parity ----------------

@pytest.fixture(scope="module")
def ts_results():
    scen_path = os.path.join(HERE, "_bot_scenarios.json")
    with open(scen_path, "w") as f:
        json.dump(SCENARIOS, f)
    try:
        out = subprocess.run(
            ["node", os.path.join(HERE, "parity_runner.cjs"), scen_path],
            capture_output=True, text=True, timeout=120)
        assert out.returncode == 0, out.stderr[:2000]
        return json.loads(out.stdout)
    finally:
        os.remove(scen_path)


def test_parity_python_typescript(ts_results):
    """Both engines must take exactly the same decisions on the same deals."""
    for name, py in PY.items():
        ts = ts_results[name]
        assert ts["play"] == py["play"], f"{name}: play {ts['play']} != {py['play']}"
        assert ts["partner_strength"] == py["partner_strength"], name
        assert ts["capot"] == py["capot"], name
        assert ts["trumps_left"] == py["trumps_left"], name
        assert ts["control"] == py["control"], name
        assert ts["sure"] == py["sure"], name
