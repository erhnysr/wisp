"""HTTP access to Wisp's public JSON API: https only, bounded in size and time, one error per failure."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from typing import Any

VERSION = "0.1.0"
USER_AGENT = f"wisp-hermes/{VERSION}"
DEFAULT_BASE_URL = "https://wisp-watch.vercel.app"
MAX_RESPONSE_BYTES = 4 * 1024 * 1024

# (method, url, json body or None, timeout seconds) -> (HTTP status, response bytes)
Transport = Callable[[str, str, "bytes | None", float], "tuple[int, bytes]"]


class InputError(ValueError):
    """The tool arguments or the plugin settings are not usable; nothing was sent."""


class NotFound(Exception):
    """Wisp answered, and what was asked for does not exist."""


class ApiError(Exception):
    """Wisp answered with an error, or with something that is not the JSON it documents."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class Unavailable(Exception):
    """Wisp, or the Technocore network behind it, could not be reached in time."""


class _HttpsOnlyRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != "https":
            raise Unavailable(f"Wisp redirected to a non-https address ({newurl}); not following it")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPENER = urllib.request.build_opener(_HttpsOnlyRedirects)


def _read_capped(stream: Any) -> bytes:
    data = stream.read(MAX_RESPONSE_BYTES + 1)
    if len(data) > MAX_RESPONSE_BYTES:
        raise Unavailable("Wisp sent more than 4 MiB; not reading it")
    return data


def http_transport(method: str, url: str, body: bytes | None, timeout: float) -> tuple[int, bytes]:
    headers = {"accept": "application/json", "user-agent": USER_AGENT}
    if body is not None:
        headers["content-type"] = "application/json"
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with _OPENER.open(request, timeout=timeout) as response:
            return response.status, _read_capped(response)
    except urllib.error.HTTPError as err:
        try:
            return err.code, _read_capped(err)
        finally:
            err.close()
    except urllib.error.URLError as err:
        raise Unavailable(f"Wisp is unreachable: {err.reason}") from err
    except (TimeoutError, OSError) as err:
        raise Unavailable(f"Wisp is unreachable: {err}") from err


def validate_base_url(value: Any) -> str:
    """The configured Wisp address, normalised; https only, no credentials, query or fragment."""
    text = str(value or "").strip()
    parts = urllib.parse.urlsplit(text)
    if parts.scheme != "https" or not parts.hostname:
        raise InputError(f"base_url must be an https:// address, got {text!r}")
    if parts.username or parts.password or parts.query or parts.fragment:
        raise InputError("base_url must not carry credentials, a query or a fragment")
    return text.rstrip("/")


def _error_message(raw: bytes, status: int) -> str:
    try:
        body = json.loads(raw)
    except ValueError:
        return f"HTTP {status}"
    if isinstance(body, dict) and isinstance(body.get("error"), str):
        return body["error"]
    return f"HTTP {status}"


class WispClient:
    def __init__(self, base_url: str, timeout: float, transport: Transport = http_transport):
        self.base_url = base_url
        self.timeout = timeout
        self.transport = transport

    def url(self, path: str, params: dict[str, Any] | None = None) -> str:
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        return f"{self.base_url}{path}{query}"

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        return self._request("GET", self.url(path, params), None)

    def post(self, path: str, payload: Any) -> dict:
        return self._request("POST", self.url(path), json.dumps(payload).encode())

    def _request(self, method: str, url: str, body: bytes | None) -> dict:
        status, raw = self.transport(method, url, body, self.timeout)
        if status == 200:
            try:
                parsed = json.loads(raw)
            except ValueError as err:
                raise ApiError(status, "Wisp returned something that is not JSON") from err
            if not isinstance(parsed, dict):
                raise ApiError(status, "Wisp returned JSON that is not an object")
            return parsed
        message = _error_message(raw, status)
        if status == 400:
            raise InputError(message)
        if status == 404:
            raise NotFound(message)
        if status in (502, 503, 504):
            raise Unavailable(message)
        raise ApiError(status, f"Wisp error (HTTP {status}): {message}")
