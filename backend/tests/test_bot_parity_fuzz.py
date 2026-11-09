"""Bot AI v2 — randomized Python/TypeScript parity fuzz (iteration 35).

Self-plays N random deals with the Python bot (bot_ai.bot_play), records the
state at EVERY card decision, then replays every recorded state through the
TypeScript engine (tests/parity_runner.cjs) and asserts identical decisions.
Also asserts every Python decision is a legal move.
"""
import json
import os
import random
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bot_ai  # noqa: E402
from game_logic import legal_moves, trick_winner  # noqa: E402

HERE = os.path.dirname(__file__)
RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]
SUITS = ["S", "H", "D", "C"]
N_DEALS = int(os.environ.get("FUZZ_DEALS", "60"))


def _deck():
    return [r + s for s in SUITS for r in RANKS]


def _random_bids(rng, trump, bid_team):
    """Plausible public auction: contract owner's team bid, some passes."""
    owner = rng.choice([bid_team, bid_team + 2])
    bids = []
    start = rng.randrange(4)
    for i in range(4):
        s = (start + i) % 4
        if s == owner:
            bids.append({"seat": s, "type": "bid",
                         "value": rng.choice([90, 100, 110, 120]),
                         "suit": trump})
        elif rng.random() < 0.25 and s % 2 == bid_team:
            bids.append({"seat": s, "type": "bid", "value": 90,
                         "suit": rng.choice(SUITS)})
        else:
            bids.append({"seat": s, "type": "pass"})
    if rng.random() < 0.2:
        return None
    return bids


def _gen_states(seed):
    rng = random.Random(seed)
    states, illegal = [], []
    for d in range(N_DEALS):
        deck = _deck()
        rng.shuffle(deck)
        hands = [deck[i * 8:(i + 1) * 8] for i in range(4)]
        trump = rng.choice(SUITS)
        bid_team = rng.randrange(2)
        bids = _random_bids(rng, trump, bid_team)
        history = []
        leader = rng.randrange(4)
        for _t in range(8):
            trick = []
            for k in range(4):
                seat = (leader + k) % 4
                sc = {"seat": seat, "trump": trump, "bid_team": bid_team,
                      "hand": list(hands[seat]), "trick": list(trick),
                      "history": list(history), "bids": bids}
                card = bot_ai.bot_play(sc["hand"], sc["trick"], trump, seat,
                                       sc["history"], bid_team, bids)
                legal = legal_moves(hands[seat], trick, trump, seat)
                if card not in legal:
                    illegal.append((d, seat, card, legal))
                    card = legal[0]
                sc["py_play"] = card
                states.append(sc)
                hands[seat].remove(card)
                trick.append({"seat": seat, "card": card})
            leader = trick_winner(trick, trump)
            history.extend(trick)
    return states, illegal


STATES, ILLEGAL = _gen_states(20260135)


def test_python_bot_always_legal():
    assert not ILLEGAL, f"illegal moves: {ILLEGAL[:5]}"


@pytest.fixture(scope="module")
def ts_results():
    scen = {f"st{i}": {k: v for k, v in s.items() if k != "py_play"}
            for i, s in enumerate(STATES)}
    path = os.path.join(HERE, "_fuzz_scenarios.json")
    with open(path, "w") as f:
        json.dump(scen, f)
    try:
        out = subprocess.run(["node", os.path.join(HERE, "parity_runner.cjs"),
                              path], capture_output=True, text=True,
                             timeout=240)
        assert out.returncode == 0, out.stderr[:2000]
        return json.loads(out.stdout)
    finally:
        os.remove(path)


def test_fuzz_parity_play(ts_results):
    """TS botPlay must pick the same card as Python on every state."""
    bad = []
    for i, s in enumerate(STATES):
        ts = ts_results[f"st{i}"]["play"]
        if ts != s["py_play"]:
            bad.append({"i": i, "py": s["py_play"], "ts": ts, "state": s})
    print(f"\nstates={len(STATES)} mismatches={len(bad)}")
    assert not bad, json.dumps(bad[:3])[:3000]


def test_fuzz_parity_helpers(ts_results):
    """Helper outputs (partner strength, capot, control) must match."""
    bad = []
    for i, s in enumerate(STATES):
        ts = ts_results[f"st{i}"]
        mem = bot_ai.build_memory(s["history"], s["trick"], s["trump"])
        py = {
            "partner_strength": bot_ai.partner_strength(
                s["bids"], s["seat"], s["trump"], s["hand"], mem),
            "capot": bot_ai.capot_potential(s["hand"], mem, s["trump"],
                                            s["seat"], s["bids"],
                                            s["history"]),
            "trumps_left": bot_ai.trumps_left(mem, s["hand"], s["trump"]),
            "control": bot_ai.team_trump_control(s["hand"], mem, s["trump"],
                                                 s["seat"], s["bids"]),
        }
        for k, v in py.items():
            if ts[k] != v:
                bad.append({"i": i, "field": k, "py": v, "ts": ts[k]})
    print(f"\nhelper mismatches={len(bad)}")
    assert not bad, json.dumps(bad[:5])
