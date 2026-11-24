"""The HTTP layer: https only, capped reads, and error mapping, against a local server and fakes."""

import io
import json
import urllib.error

import pytest
from wisp_technocore import client


class FakeResponse(io.BytesIO):
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


@pytest.mark.parametrize(
    "value, expected",
    [
        ("https://wisp-watch.vercel.app/", "https://wisp-watch.vercel.app"),
        ("  https://example.org/wisp  ", "https://example.org/wisp"),
    ],
)
def test_base_url_is_normalised(value, expected):
    assert client.validate_base_url(value) == expected


@pytest.mark.parametrize(
    "value",
    [
        "http://wisp-watch.vercel.app",
        "ftp://x",
        "wisp-watch.vercel.app",
        "",
        None,
        "https://user:pw@example.org",
        "https://example.org/?a=1",
        "https://example.org/#x",
        "https://",
    ],
)
def test_base_url_refuses_anything_but_plain_https(value):
    with pytest.raises(client.InputError):
        client.validate_base_url(value)


def test_transport_sends_json_headers_and_reads_the_body(monkeypatch):
    seen = {}

    def fake_open(request, timeout):
        seen.update(
            url=request.full_url,
            method=request.get_method(),
            timeout=timeout,
            headers={k.lower(): v for k, v in request.header_items()},
            data=request.data,
        )
        return FakeResponse(b'{"ok": true}')

    monkeypatch.setattr(client._OPENER, "open", fake_open)
    status, raw = client.http_transport("POST", "https://example.org/api", b'{"a": 1}', 7.0)
    assert (status, json.loads(raw)) == (200, {"ok": True})
    assert seen["method"] == "POST" and seen["timeout"] == 7.0 and seen["data"] == b'{"a": 1}'
    assert seen["headers"]["content-type"] == "application/json"
    assert seen["headers"]["user-agent"] == client.USER_AGENT


def test_transport_refuses_bodies_over_four_mib(monkeypatch):
    monkeypatch.setattr(
        client._OPENER, "open", lambda request, timeout: FakeResponse(b"x" * (client.MAX_RESPONSE_BYTES + 1))
    )
    with pytest.raises(client.Unavailable, match="4 MiB"):
        client.http_transport("GET", "https://example.org/api", None, 5.0)


def test_transport_returns_http_errors_with_their_body(monkeypatch):
    def fail(request, timeout):
        raise urllib.error.HTTPError(
            request.full_url, 404, "Not Found", {}, io.BytesIO(b'{"error": "Deal not found."}')
        )

    monkeypatch.setattr(client._OPENER, "open", fail)
    assert client.http_transport("GET", "https://example.org/api", None, 5.0) == (404, b'{"error": "Deal not found."}')


@pytest.mark.parametrize(
    "exc", [urllib.error.URLError("name resolution failed"), TimeoutError("timed out"), ConnectionResetError()]
)
def test_transport_turns_network_failures_into_unavailable(monkeypatch, exc):
    def fail(request, timeout):
        raise exc

    monkeypatch.setattr(client._OPENER, "open", fail)
    with pytest.raises(client.Unavailable):
        client.http_transport("GET", "https://example.org/api", None, 5.0)


def test_redirects_to_plain_http_are_not_followed():
    handler = client._HttpsOnlyRedirects()
    with pytest.raises(client.Unavailable, match="non-https"):
        handler.redirect_request(None, None, 302, "Found", {}, "http://evil.example/api")


@pytest.mark.parametrize(
    "status, body, error",
    [
        (400, b'{"error": "bad DID"}', client.InputError),
        (404, b'{"error": "Deal not found."}', client.NotFound),
        (502, b'{"error": "technocore-chat is not responding"}', client.Unavailable),
        (503, b"Service Unavailable", client.Unavailable),
        (429, b'{"error": "slow down"}', client.ApiError),
    ],
)
def test_status_codes_map_to_one_error_each(status, body, error):
    wisp = client.WispClient("https://example.org", 5.0, lambda *a: (status, body))
    with pytest.raises(error):
        wisp.get("/api/x")
