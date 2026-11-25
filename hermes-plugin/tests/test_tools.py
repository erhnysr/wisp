"""Every tool against a fake Wisp answering with recorded responses."""

import json

import pytest
from conftest import OWN_DID, load


def test_did_signal_passes_wisp_answer_through_with_its_caveats(run, wisp):
    out = run("wisp_did_signal", {"did": f"  {OWN_DID} "})
    assert wisp.calls == [("GET", "/api/lookup", {"did": OWN_DID}, None)]
    assert out["did"] == OWN_DID and out["roomsScanned"] == 15
    metrics = out["summary"]["metrics"]
    assert metrics and all(m["proves"] and m["doesntProve"] for m in metrics)
    assert out["identityNote"]["found"] is True and out["identityNote"]["namesThisDid"] is True
    assert "watch list" in out["note"]
    assert out["source"].startswith("https://wisp-watch.vercel.app/api/lookup?did=did%3Akey%3Az6Mk")


def test_did_signal_drops_the_indexer_room_table_but_counts_it(run, wisp):
    out = run("wisp_did_signal", {"did": OWN_DID})
    recorded = load("lookup")["history"]["watched"]
    assert "watched" not in out["history"]
    assert out["history"]["indexerWatchedRooms"] == len(recorded) > 0
    assert out["history"]["tracking"]["active"] is True


def test_did_signal_cuts_long_deal_lists_and_says_so(run, wisp):
    body = load("lookup")
    many = load("deals")["deals"]
    body["dealSignal"] = {**body["dealSignal"], "totalDeals": len(many), "deals": many}
    wisp.routes["GET /api/lookup"] = (200, body)
    out = run("wisp_did_signal", {"did": OWN_DID})
    assert len(many) > 10
    assert out["dealSignal"]["dealsShown"] == 10 and out["dealSignal"]["totalDeals"] == len(many)
    assert out["dealSignal"]["deals"] == many[:10]


@pytest.mark.parametrize("did", ["nope", "did:key:zBAD", "did:web:example.com", "", None, 42, OWN_DID + "x" * 10])
def test_did_signal_refuses_malformed_dids_without_a_request(run, wisp, did):
    out = run("wisp_did_signal", {"did": did})
    assert out["error_type"] == "invalid_input" and wisp.calls == []


def test_did_signal_reports_wisps_own_400_as_invalid_input(run, wisp):
    wisp.routes["GET /api/lookup"] = (400, load("lookup_bad"))
    out = run("wisp_did_signal", {"did": OWN_DID})
    assert out == {"error": load("lookup_bad")["error"], "error_type": "invalid_input"}


def test_a_technocore_outage_is_unavailable(run, wisp):
    wisp.routes["GET /api/lookup"] = (
        502,
        {"error": "technocore-chat is not responding right now — try again shortly."},
    )
    out = run("wisp_did_signal", {"did": OWN_DID})
    assert out["error_type"] == "unavailable" and "not responding" in out["error"]


def test_compare_posts_once_and_builds_a_side_by_side_table(run, wisp):
    out = run("wisp_compare_dids", {"dids": [OWN_DID, "did:key:zBAD", OWN_DID]})
    assert wisp.calls == [("POST", "/api/lookup/bulk", {}, {"dids": [OWN_DID, "did:key:zBAD"]})]
    rows = out["comparison"]
    assert rows[0]["did"] == OWN_DID and rows[0]["ok"] is True and rows[0]["totalDeals"] == 0
    assert rows[-1] == {"did": "did:key:zBAD", "ok": False, "error": load("bulk")["results"][1]["error"]}
    assert out["roomsScanned"] == 15 and "each DID" in out["note"]


@pytest.mark.parametrize("dids", [[], [OWN_DID], [OWN_DID, OWN_DID], "did:key:z6Mk...", [OWN_DID, 7]])
def test_compare_needs_two_to_twenty_five_distinct_strings(run, wisp, dids):
    out = run("wisp_compare_dids", {"dids": dids})
    assert out["error_type"] == "invalid_input" and wisp.calls == []


def test_compare_refuses_more_than_twenty_five(run, wisp):
    many = [OWN_DID[:-4] + f"{i:04d}".replace("0", "A") for i in range(26)]
    out = run("wisp_compare_dids", {"dids": many})
    assert out["error_type"] == "invalid_input" and wisp.calls == []


def test_rooms_default_and_explicit_limits(run, wisp):
    out = run("wisp_rooms")
    assert wisp.calls[-1][2] == {"limit": "10"} and len(out["rooms"]) == 10
    out = run("wisp_rooms", {"limit": 3})
    assert wisp.calls[-1][2] == {"limit": "3"} and len(out["rooms"]) == 3
    assert out["rooms"][0]["room"] == load("rooms_many")["rooms"][0]["room"]
    assert all(len(r["topic"] or "") <= 201 for r in out["rooms"])


@pytest.mark.parametrize("limit", [0, 51, 2.5, "ten", True])
def test_rooms_refuses_a_bad_limit(run, wisp, limit):
    out = run("wisp_rooms", {"limit": limit})
    assert out["error_type"] == "invalid_input" and wisp.calls == []


def test_deals_lists_newest_first_with_totals(run):
    out = run("wisp_deals", {"limit": 5})
    recorded = load("deals")
    assert out["stats"] == recorded["stats"] and out["matching"] == len(recorded["deals"]) and out["shown"] == 5
    stamps = [d["lastUpdate"] for d in out["deals"]]
    assert stamps == sorted(stamps, reverse=True)


def test_deals_filters_by_state_and_by_did(run):
    recorded = load("deals")["deals"]
    party = recorded[0]["accepter"]
    out = run("wisp_deals", {"did": party, "state": "accepted"})
    expected = [d for d in recorded if party in (d["offerer"], d["accepter"]) and d["state"] == "accepted"]
    assert out["matching"] == len(expected) > 0
    assert all(party in (d["offerer"], d["accepter"]) for d in out["deals"])
    assert run("wisp_deals", {"state": "claimed"})["matching"] == 0


@pytest.mark.parametrize("args", [{"state": "open"}, {"did": "alice"}, {"limit": 0}])
def test_deals_refuses_bad_filters(run, wisp, args):
    assert run("wisp_deals", args)["error_type"] == "invalid_input" and wisp.calls == []


def test_deal_returns_the_detail_page_with_its_history(run, wisp):
    listed = load("deals")["deals"][0]
    events = [{"type": "offer", "from": listed["offerer"], "ts": listed["offeredAt"], "resultState": "proposed"}] * 60
    wisp.detail[listed["contractId"]] = (
        200,
        {"generatedAt": "2026-11-24T20:40:00Z", "deal": {**listed, "events": events}},
    )
    out = run("wisp_deal", {"id": listed["contractId"]})
    assert out["deal"]["offerId"] == listed["offerId"] and len(out["deal"]["events"]) == 50 and out["eventsTotal"] == 60
    assert [c[1] for c in wisp.calls] == [f"/api/deals/{listed['contractId']}"]


@pytest.mark.parametrize("key", ["offerId", "contractId"])
def test_deal_falls_back_to_the_list_when_the_detail_page_misses_it(run, wisp, key):
    # Recorded behaviour: wisp-watch answered 404 "Deal not found." for a deal its list showed.
    listed = load("deals")["deals"][2]
    out = run("wisp_deal", {"id": listed[key].upper().replace("0X", "0x")})
    assert out["deal"] == listed and out["eventsTotal"] is None and "without the frame-by-frame history" in out["note"]
    assert [c[1] for c in wisp.calls] == [f"/api/deals/{listed[key].upper().replace('0X', '0x')}", "/api/deals"]


def test_deal_not_in_wisp_at_all_is_not_found(run):
    out = run("wisp_deal", {"id": "0x" + "ab" * 32})
    assert out["error_type"] == "not_found" and "0x" + "ab" * 32 in out["error"]


@pytest.mark.parametrize("deal_id", ["0x1234", "ab" * 32, "0x" + "zz" * 32, None, "../analytics"])
def test_deal_refuses_ids_that_are_not_32_byte_hex(run, wisp, deal_id):
    assert run("wisp_deal", {"id": deal_id})["error_type"] == "invalid_input" and wisp.calls == []


def test_deal_analytics_cuts_the_top_list(run, wisp):
    body = load("analytics")
    body["pulse"]["topDids"] = body["pulse"]["topDids"] * 3
    wisp.routes["GET /api/deals/analytics"] = (200, body)
    out = run("wisp_deal_analytics")
    assert len(out["pulse"]["topDids"]) == 10 and out["pulse"]["topDidsTotal"] == len(body["pulse"]["topDids"])
    assert out["pulse"]["claimedSampleSize"] == body["pulse"]["claimedSampleSize"]


def test_non_json_and_non_object_answers_are_api_errors(run, wisp):
    wisp.routes["GET /api/rooms"] = (200, b"<html>maintenance</html>")
    assert run("wisp_rooms")["error_type"] == "api_error"
    wisp.routes["GET /api/rooms"] = (200, [1, 2])
    assert run("wisp_rooms")["error_type"] == "api_error"


def test_an_unexpected_status_is_an_api_error_with_the_status(run, wisp):
    wisp.routes["GET /api/deals/analytics"] = (500, {"error": "boom"})
    out = run("wisp_deal_analytics")
    assert out == {"error": "Wisp error (HTTP 500): boom", "error_type": "api_error", "http_status": 500}


def test_a_handler_never_raises(run, wisp):
    def explode(*_a):
        raise RuntimeError("transport bug")

    from wisp_technocore import tools

    out = json.loads(tools.make_handler("wisp_rooms", transport=explode)({}))
    assert out["error_type"] == "internal_error" and "transport bug" in out["error"]
    assert json.loads(tools.make_handler("wisp_rooms", transport=wisp)("not a dict"))["rooms"]


def test_timeout_setting_is_clamped(run, wisp):
    seen = []
    from wisp_technocore import tools

    def spy(method, url, body, timeout):
        seen.append(timeout)
        return wisp(method, url, body, timeout)

    for value, expected in [(0, 1.0), (99, 30.0), ("x", 15.0), (5, 5.0)]:
        tools.make_handler("wisp_rooms", lambda k, d, v=value: v if k == "timeout_seconds" else d, transport=spy)({})
        assert seen[-1] == expected
