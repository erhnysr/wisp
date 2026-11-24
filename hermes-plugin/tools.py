"""Tool handlers. Each takes the tool arguments and returns a JSON string, and never raises.

Wisp's answers are passed through in its own field names, with long lists cut down so a tool result
stays small enough for the model to read; every cut list says how many items it had.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.parse
from collections.abc import Callable
from typing import Any

from .client import (
    DEFAULT_BASE_URL,
    ApiError,
    InputError,
    NotFound,
    Transport,
    Unavailable,
    WispClient,
    http_transport,
    validate_base_url,
)

logger = logging.getLogger(__name__)

Settings = Callable[[str, Any], Any]

DID_RE = re.compile(r"^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{40,50}$")
DEAL_ID_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
STATES = ("proposed", "accepted", "locked", "claimed", "refunded", "cancelled")
MAX_COMPARE = 25
MAX_LIST = 50
DEFAULT_ROOMS = 10
DEFAULT_DEALS = 20
SIGNAL_DEALS_SHOWN = 10
COMPARE_DEALS_SHOWN = 5
ROOMS_SEEN_SHOWN = 10
EVENTS_SHOWN = 50
TOP_DIDS_SHOWN = 10
TOPIC_CHARS = 200
NOTE_CHARS = 500
WATCH_NOTE = (
    "Wisp's indexer records only DIDs someone has looked up, so this lookup added the DID to its "
    "watch list (tracking.since shows when tracking began)."
)


def _no_settings(_key: str, default: Any) -> Any:
    return default


def _client(settings: Settings, transport: Transport) -> WispClient:
    base_url = validate_base_url(settings("base_url", DEFAULT_BASE_URL))
    try:
        timeout = int(settings("timeout_seconds", 15))
    except (TypeError, ValueError):
        timeout = 15
    return WispClient(base_url, float(min(max(timeout, 1), 30)), transport)


def _did(value: Any, field: str = "did") -> str:
    text = value.strip() if isinstance(value, str) else ""
    if not DID_RE.match(text):
        raise InputError(f"{field} must be an Ed25519 did:key identifier (did:key:z6Mk...), got {value!r}")
    return text


def _limit(value: Any, default: int) -> int:
    if value in (None, ""):
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value:
        raise InputError(f"limit must be a whole number from 1 to {MAX_LIST}, got {value!r}")
    if not 1 <= int(value) <= MAX_LIST:
        raise InputError(f"limit must be from 1 to {MAX_LIST}, got {int(value)}")
    return int(value)


def _cut(items: Any, keep: int) -> tuple[list, int]:
    items = items if isinstance(items, list) else []
    return items[:keep], len(items)


def _trim_signal(body: dict, deals_shown: int) -> dict:
    out = dict(body)
    summary = out.get("summary")
    if isinstance(summary, dict):
        summary = dict(summary)
        summary["roomsSeenIn"], summary["roomsSeenInTotal"] = _cut(summary.get("roomsSeenIn"), ROOMS_SEEN_SHOWN)
        out["summary"] = summary
    deals = out.get("dealSignal")
    if isinstance(deals, dict):
        deals = dict(deals)
        deals["deals"], total = _cut(deals.get("deals"), deals_shown)
        deals["dealsShown"] = len(deals["deals"])
        deals.setdefault("totalDeals", total)
        out["dealSignal"] = deals
    note = out.get("identityNote")
    if isinstance(note, dict) and isinstance(note.get("text"), str) and len(note["text"]) > NOTE_CHARS:
        out["identityNote"] = {**note, "text": note["text"][:NOTE_CHARS] + "…", "textTruncated": True}
    history = out.get("history")
    if isinstance(history, dict):
        history = dict(history)
        history["rooms"], history["roomsTotal"] = _cut(history.get("rooms"), ROOMS_SEEN_SHOWN)
        watched = history.pop("watched", None)
        if isinstance(watched, list):
            history["indexerWatchedRooms"] = len(watched)
        out["history"] = history
    return out


def did_signal(client: WispClient, args: dict) -> dict:
    did = _did(args.get("did"))
    body = client.get("/api/lookup", {"did": did})
    out = _trim_signal(body, SIGNAL_DEALS_SHOWN)
    out["note"] = WATCH_NOTE
    out["source"] = client.url("/api/lookup", {"did": did})
    return out


def _row(result: dict) -> dict:
    if not result.get("ok", True):
        return {"did": result.get("did"), "ok": False, "error": result.get("error")}
    summary = result.get("summary") if isinstance(result.get("summary"), dict) else {}
    deals = result.get("dealSignal") if isinstance(result.get("dealSignal"), dict) else {}
    rooms = summary.get("roomsSeenIn")
    return {
        "did": result.get("did"),
        "ok": True,
        "totalMessages": summary.get("totalMessages"),
        "signedMessages": summary.get("signedMessages"),
        "roomsSeenIn": summary.get("roomsSeenInTotal", len(rooms) if isinstance(rooms, list) else None),
        "totalDeals": deals.get("totalDeals"),
        "completionRate": deals.get("completionRate"),
    }


def compare_dids(client: WispClient, args: dict) -> dict:
    raw = args.get("dids")
    if not isinstance(raw, list) or not all(isinstance(d, str) for d in raw):
        raise InputError("dids must be a list of did:key strings")
    dids = list(dict.fromkeys(d.strip() for d in raw if d.strip()))
    if not 2 <= len(dids) <= MAX_COMPARE:
        raise InputError(f"give 2 to {MAX_COMPARE} different DIDs to compare, got {len(dids)}")
    if any(len(d) > 128 for d in dids):
        raise InputError("a did:key identifier is never longer than 128 characters")
    body = client.post("/api/lookup/bulk", {"dids": dids})
    results = [
        _trim_signal(r, COMPARE_DEALS_SHOWN) if isinstance(r, dict) and r.get("ok", True) else r
        for r in (body.get("results") if isinstance(body.get("results"), list) else [])
    ]
    rows = [_row(r) for r in results if isinstance(r, dict)]
    rows.sort(key=lambda r: (not r["ok"], -(r.get("totalMessages") or 0), -(r.get("totalDeals") or 0)))
    return {
        "roomsScanned": body.get("roomsScanned"),
        "comparison": rows,
        "results": results,
        "note": "Each DID's metrics carry what they prove and what they do not; this is not a ranking of trust. "
        + WATCH_NOTE.replace("this lookup added the DID", "these lookups added each DID"),
    }


def rooms(client: WispClient, args: dict) -> dict:
    limit = _limit(args.get("limit"), DEFAULT_ROOMS)
    body = client.get("/api/rooms", {"limit": limit})
    listed = []
    for room in body.get("rooms") if isinstance(body.get("rooms"), list) else []:
        if isinstance(room, dict) and isinstance(room.get("topic"), str) and len(room["topic"]) > TOPIC_CHARS:
            room = {**room, "topic": room["topic"][:TOPIC_CHARS] + "…"}
        listed.append(room)
    return {"generatedAt": body.get("generatedAt"), "rooms": listed[:limit]}


def _all_deals(client: WispClient) -> dict:
    body = client.get("/api/deals")
    if not isinstance(body.get("deals"), list):
        raise ApiError(200, "Wisp's deal list is missing its 'deals' array")
    return body


def deals(client: WispClient, args: dict) -> dict:
    state = args.get("state")
    if state not in (None, "") and state not in STATES:
        raise InputError(f"state must be one of {', '.join(STATES)}, got {state!r}")
    did = _did(args["did"]) if args.get("did") not in (None, "") else None
    limit = _limit(args.get("limit"), DEFAULT_DEALS)
    body = _all_deals(client)
    matching = [
        d
        for d in body["deals"]
        if isinstance(d, dict)
        and (not state or d.get("state") == state)
        and (not did or did in (d.get("offerer"), d.get("accepter")))
    ]
    matching.sort(key=lambda d: str(d.get("lastUpdate") or d.get("offeredAt") or ""), reverse=True)
    return {
        "generatedAt": body.get("generatedAt"),
        "stats": body.get("stats"),
        "matching": len(matching),
        "shown": min(len(matching), limit),
        "deals": matching[:limit],
    }


def deal(client: WispClient, args: dict) -> dict:
    raw = args.get("id")
    deal_id = raw.strip() if isinstance(raw, str) else ""
    if not DEAL_ID_RE.match(deal_id):
        raise InputError(f"id must be a deal's offer or contract ID: 0x and 64 hex characters, got {raw!r}")
    try:
        body = client.get("/api/deals/" + urllib.parse.quote(deal_id))
    except NotFound:
        body = None
    found = body.get("deal") if isinstance(body, dict) else None
    if isinstance(found, dict):
        events, total = _cut(found.get("events"), EVENTS_SHOWN)
        return {"generatedAt": body.get("generatedAt"), "deal": {**found, "events": events}, "eventsTotal": total}
    # Wisp's detail page reads the offers room on its own; when it misses a deal its list has, the
    # list entry still answers with the deal's state, parties and terms (without the frame history).
    listing = _all_deals(client)
    wanted = deal_id.lower()
    for item in listing["deals"]:
        if isinstance(item, dict) and wanted in (
            str(item.get("offerId", "")).lower(),
            str(item.get("contractId", "")).lower(),
        ):
            return {
                "generatedAt": listing.get("generatedAt"),
                "deal": item,
                "eventsTotal": None,
                "note": "Wisp's deal page did not return this deal, so this is its entry in the deal list: "
                "state, parties and terms, without the frame-by-frame history.",
            }
    raise NotFound(f"No tclk deal with offer or contract ID {deal_id} in Wisp's current view of the offers room")


def deal_analytics(client: WispClient, _args: dict) -> dict:
    body = client.get("/api/deals/analytics")
    pulse = body.get("pulse")
    if isinstance(pulse, dict):
        pulse = dict(pulse)
        pulse["topDids"], pulse["topDidsTotal"] = _cut(pulse.get("topDids"), TOP_DIDS_SHOWN)
    return {"generatedAt": body.get("generatedAt"), "pulse": pulse}


_BODIES: dict[str, Callable[[WispClient, dict], dict]] = {
    "wisp_did_signal": did_signal,
    "wisp_compare_dids": compare_dids,
    "wisp_rooms": rooms,
    "wisp_deals": deals,
    "wisp_deal": deal,
    "wisp_deal_analytics": deal_analytics,
}


def _run(name: str, args: Any, settings: Settings, transport: Transport) -> str:
    try:
        client = _client(settings, transport)
        return json.dumps(_BODIES[name](client, args if isinstance(args, dict) else {}), ensure_ascii=False)
    except InputError as err:
        return json.dumps({"error": str(err), "error_type": "invalid_input"})
    except NotFound as err:
        return json.dumps({"error": str(err), "error_type": "not_found"})
    except Unavailable as err:
        return json.dumps({"error": str(err), "error_type": "unavailable"})
    except ApiError as err:
        return json.dumps({"error": str(err), "error_type": "api_error", "http_status": err.status})
    except Exception as err:  # never let a tool call raise into Hermes
        logger.exception("wisp %s failed", name)
        return json.dumps({"error": f"{type(err).__name__}: {err}", "error_type": "internal_error"})


def make_handler(name: str, settings: Settings = _no_settings, transport: Transport = http_transport):
    if name not in _BODIES:
        raise KeyError(name)

    def handler(args: dict, **_kwargs: Any) -> str:
        return _run(name, args, settings, transport)

    handler.__name__ = name
    return handler
