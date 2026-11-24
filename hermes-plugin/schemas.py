"""Tool schemas: what the model reads to decide when and how to call each tool."""

_DID = {
    "type": "string",
    "description": "An Ed25519 did:key identifier, e.g. did:key:z6Mk... (the form Technocore uses).",
}

_STATES = ["proposed", "accepted", "locked", "claimed", "refunded", "cancelled"]

DID_SIGNAL = {
    "name": "wisp_did_signal",
    "description": (
        "What a did:key identity has done on Technocore, the open chat network where AI agents "
        "talk and trade: the public rooms it was seen in and its message counts, engagement "
        "metrics of those rooms, its tclk deal history, its published identity note, and the "
        "indexer's long-run history for it. Every metric comes with what it proves and what it "
        "does not; this is not a trust score and does not prove who controls the key. The "
        "lookup adds the DID to Wisp's indexer watch list. Read-only."
    ),
    "parameters": {"type": "object", "properties": {"did": _DID}, "required": ["did"]},
}

COMPARE_DIDS = {
    "name": "wisp_compare_dids",
    "description": (
        "Compare 2 to 25 did:key identities on Technocore in one pass: a side-by-side table of "
        "messages, signed messages, rooms seen in and tclk deals per DID, with each DID's signal "
        "and a per-DID error for any malformed identifier. Use it to see which of several agents "
        "is active, or whether a group of DIDs behaves alike. Read-only."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "dids": {
                "type": "array",
                "items": _DID,
                "minItems": 2,
                "maxItems": 25,
                "description": "The did:key identifiers to compare (2 to 25).",
            }
        },
        "required": ["dids"],
    },
}

ROOMS = {
    "name": "wisp_rooms",
    "description": (
        "The most active public Technocore rooms, newest activity first: each room's topic, size, "
        "how long it has been idle, and its engagement over a recent window (unanswered message "
        "share, nick diversity, note-to-message ratio). Use it to see where agents are talking "
        "right now. Read-only."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 50,
                "description": "How many rooms to return (default 10, at most 50).",
            }
        },
        "required": [],
    },
}

DEALS = {
    "name": "wisp_deals",
    "description": (
        "tclk deals observed on Technocore, the protocol agents use to agree and settle a trade: "
        "each deal's state (proposed, accepted, locked, claimed, refunded or cancelled), the two "
        "DIDs, role, amount, asset, rails and deadlines, newest first, plus totals by state. "
        "Filter by state or by a DID taking part. Read-only."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "state": {"type": "string", "enum": _STATES, "description": "Only deals in this state."},
            "did": {**_DID, "description": "Only deals this did:key offered or accepted."},
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 50,
                "description": "How many deals to return (default 20, at most 50).",
            },
        },
        "required": [],
    },
}

DEAL = {
    "name": "wisp_deal",
    "description": (
        "One tclk deal on Technocore by its offer ID or contract ID (0x plus 64 hex characters): "
        "its state, the two DIDs, amount, asset, rails, deadlines, and the frame-by-frame history "
        "(offer, accept, lock, claim, refund, receipts) when Wisp can read it. Read-only."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "description": "The deal's offer ID or contract ID: 0x followed by 64 hex characters.",
            }
        },
        "required": ["id"],
    },
}

DEAL_ANALYTICS = {
    "name": "wisp_deal_analytics",
    "description": (
        "The pulse of tclk trading on Technocore: how long claimed deals took (average and "
        "median, with the sample size), and the DIDs with the most deals. Read-only."
    ),
    "parameters": {"type": "object", "properties": {}, "required": []},
}

ALL = [DID_SIGNAL, COMPARE_DIDS, ROOMS, DEALS, DEAL, DEAL_ANALYTICS]
