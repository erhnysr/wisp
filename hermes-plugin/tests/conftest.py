"""Load the plugin as the package ``wisp_technocore`` whatever its directory is called, and provide a
fake Wisp that answers the public API from recorded responses, with no network access.

The recorded responses in ``tests/data`` are real answers from wisp-watch.vercel.app; every DID in
them except the plugin author's own was replaced with a made-up one of the same form.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import urllib.parse

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = pathlib.Path(__file__).resolve().parent / "data"
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

if "wisp_technocore" not in sys.modules:
    spec = importlib.util.spec_from_file_location(
        "wisp_technocore", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["wisp_technocore"] = module
    spec.loader.exec_module(module)

OWN_DID = "did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA"
BASE = "https://wisp-watch.vercel.app"


def load(name: str) -> dict:
    return json.loads((DATA / f"{name}.json").read_text())


class FakeWisp:
    """Answers (method, path) with a recorded body. ``routes`` maps "GET /api/x" to (status, body)."""

    def __init__(self):
        self.calls: list[tuple[str, str, dict, object]] = []
        self.routes: dict[str, tuple[int, object]] = {
            "GET /api/lookup": (200, load("lookup")),
            "POST /api/lookup/bulk": (200, load("bulk")),
            "GET /api/rooms": (200, load("rooms_many")),
            "GET /api/deals": (200, load("deals")),
            "GET /api/deals/analytics": (200, load("analytics")),
        }
        self.detail: dict[str, tuple[int, object]] = {}

    def __call__(self, method, url, body, timeout):
        parts = urllib.parse.urlsplit(url)
        assert f"{parts.scheme}://{parts.netloc}" == BASE, url
        query = dict(urllib.parse.parse_qsl(parts.query))
        payload = json.loads(body) if body is not None else None
        self.calls.append((method, parts.path, query, payload))
        key = f"{method} {parts.path}"
        if key in self.routes:
            status, answer = self.routes[key]
        elif parts.path.startswith("/api/deals/"):
            status, answer = self.detail.get(parts.path.rsplit("/", 1)[1], (404, load("deal_missing")))
        else:
            status, answer = 404, {"error": "no such route"}
        raw = answer if isinstance(answer, bytes) else json.dumps(answer).encode()
        return status, raw


@pytest.fixture
def wisp():
    return FakeWisp()


@pytest.fixture
def run(wisp):
    from wisp_technocore import tools

    def call(name, args=None, settings=None):
        config = settings or {}
        handler = tools.make_handler(name, lambda key, default: config.get(key, default), transport=wisp)
        return json.loads(handler(args or {}))

    return call
