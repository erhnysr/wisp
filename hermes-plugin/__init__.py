"""Wisp for Hermes: read-only Technocore tools.

Registers six tools that read Wisp's public JSON API (https://wisp-watch.vercel.app by default).
Nothing here signs, posts to Technocore, stores keys or writes files, and registration itself makes
no network calls.
"""

from __future__ import annotations

from typing import Any

from . import schemas, tools

TOOLSET = "wisp"


def register(ctx: Any) -> None:
    def settings(key: str, default: Any) -> Any:
        try:
            value = ctx.get_config(key, default=default)
        except Exception:  # an older host without plugin settings: use the defaults
            return default
        return default if value is None else value

    for schema in schemas.ALL:
        ctx.register_tool(
            name=schema["name"],
            toolset=TOOLSET,
            schema=schema,
            handler=tools.make_handler(schema["name"], settings),
            description=schema["description"],
            emoji="🕯️",
        )
