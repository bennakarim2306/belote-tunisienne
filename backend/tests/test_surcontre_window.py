"""Contre reaction window: 5 seconds to surcontre or ignore, in ALL games."""
import time

import pytest

import game_logic as gl


def _players():
    return [{"user_id": f"u{i}", "username": f"P{i}", "avatar_id": 0,
             "is_bot": True, "elo": 1000} for i in range(4)]


def test_surcontre_window_is_5_seconds():
    assert gl.SURCONTRE_SECONDS == 5


@pytest.mark.parametrize("timeout", [None, 30])
def test_contre_sets_5s_deadline(timeout):
    g = gl.BeloteGame("t", _players(), "short", turn_timeout=timeout)
    bidder = g.turn
    g.apply_bid(bidder, 90, "S")
    defender = (bidder + 1) % 4
    g.apply_contre(defender)
    assert g.phase == "surcontre"
    # 5s reaction window regardless of the game being timed or not
    assert g.turn_deadline == pytest.approx(time.time() + gl.SURCONTRE_SECONDS, abs=1.5)


def test_decline_surcontre_starts_play_with_contre():
    g = gl.BeloteGame("t", _players(), "short", turn_timeout=None)
    bidder = g.turn
    g.apply_bid(bidder, 90, "S")
    g.apply_contre((bidder + 1) % 4)
    g.apply_decline_surcontre(bidder)  # "ignore" -> play the contract contred
    assert g.phase == "playing"
    assert g.contre is not None and g.surcontre is None
