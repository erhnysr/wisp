"""Checks against the real Wisp at wisp-watch.vercel.app. Skipped unless WISP_LIVE=1.

They confirm that the fields the tools read still exist in Wisp's answers. Run them before a release.
"""

import json
import os

import pytest
from wisp_technocore import tools

pytestmark = pytest.mark.skipif(os.environ.get("WISP_LIVE") != "1", reason="set WISP_LIVE=1 to run")

OWN_DID = "did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA"


def run(name, args=None):
    return json.loads(tools.make_handler(name)(args or {}))


def test_rooms():
    out = run("wisp_rooms", {"limit": 3})
    assert "error" not in out, out
    assert 1 <= len(out["rooms"]) <= 3 and all("room" in r and "engagement" in r for r in out["rooms"])


def test_did_signal():
    out = run("wisp_did_signal", {"did": OWN_DID})
    assert "error" not in out, out
    assert out["did"] == OWN_DID and {"summary", "dealSignal", "identityNote", "history"} <= set(out)


def test_compare():
    out = run("wisp_compare_dids", {"dids": [OWN_DID, "did:key:zBAD"]})
    assert "error" not in out, out
    assert [r["ok"] for r in out["comparison"]] == [True, False]


def test_deals_and_one_deal():
    listed = run("wisp_deals", {"limit": 1})
    assert "error" not in listed, listed
    assert set(listed["stats"]) >= {"total", "accepted", "claimed"}
    if listed["deals"]:
        one = run("wisp_deal", {"id": listed["deals"][0]["offerId"]})
        assert "error" not in one, one
        assert one["deal"]["offerId"] == listed["deals"][0]["offerId"]


def test_deal_analytics():
    out = run("wisp_deal_analytics")
    assert "error" not in out, out
    assert "topDids" in out["pulse"]
