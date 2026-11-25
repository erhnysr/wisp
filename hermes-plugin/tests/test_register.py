"""The plugin as Hermes sees it: register(), the manifest, and the settings."""

import json
import pathlib
import re

import wisp_technocore
from wisp_technocore import client, schemas

ROOT = pathlib.Path(__file__).resolve().parents[1]


class FakeContext:
    def __init__(self, config=None, broken_config=False):
        self.tools = {}
        self.config = config or {}
        self.broken_config = broken_config

    def register_tool(
        self,
        name,
        toolset,
        schema,
        handler,
        check_fn=None,
        requires_env=None,
        is_async=False,
        description="",
        emoji="",
        override=False,
    ):
        assert name not in self.tools
        self.tools[name] = {"toolset": toolset, "schema": schema, "handler": handler, "override": override}

    def get_config(self, key, default=None):
        if self.broken_config:
            raise RuntimeError("no plugin settings on this host")
        return self.config.get(key, default)


def manifest_list(field):
    text = (ROOT / "plugin.yaml").read_text()
    block = re.search(rf"^{field}:\n((?:  - .+\n)+)", text, re.M)
    return [line.strip()[2:] for line in block.group(1).splitlines()]


def test_registers_exactly_the_declared_tools(monkeypatch):
    def no_network(*_a, **_k):
        raise AssertionError("registration must not touch the network")

    monkeypatch.setattr(client._OPENER, "open", no_network)
    ctx = FakeContext()
    wisp_technocore.register(ctx)
    assert sorted(ctx.tools) == sorted(manifest_list("provides_tools")) == sorted(s["name"] for s in schemas.ALL)
    for name, entry in ctx.tools.items():
        assert entry["toolset"] == "wisp" and entry["override"] is False
        assert entry["schema"]["name"] == name and entry["schema"]["parameters"]["type"] == "object"


def test_schemas_are_plain_json_and_say_read_only():
    for schema in schemas.ALL:
        assert json.loads(json.dumps(schema)) == schema
        assert len(schema["description"]) < 1024
        assert "Read-only" in schema["description"]


def test_a_host_without_settings_still_registers_and_answers_input_errors():
    ctx = FakeContext(broken_config=True)
    wisp_technocore.register(ctx)
    out = json.loads(ctx.tools["wisp_did_signal"]["handler"]({"did": "nope"}))
    assert out["error_type"] == "invalid_input"


def test_a_non_https_base_url_is_refused_before_any_request(monkeypatch):
    def no_network(*_a, **_k):
        raise AssertionError("must not send anything to a refused base_url")

    monkeypatch.setattr(client._OPENER, "open", no_network)
    ctx = FakeContext(config={"base_url": "http://wisp.example"})
    wisp_technocore.register(ctx)
    out = json.loads(ctx.tools["wisp_rooms"]["handler"]({}))
    assert out["error_type"] == "invalid_input" and "https" in out["error"]


def test_manifest_settings_match_the_names_the_code_reads():
    text = (ROOT / "plugin.yaml").read_text()
    declared = set(re.findall(r"^  (\w+):\n    type:", text, re.M))
    source = (ROOT / "tools.py").read_text()
    read = set(re.findall(r'settings\("(\w+)"', source))
    assert declared == read == {"base_url", "timeout_seconds"}
    assert f"default: {client.DEFAULT_BASE_URL}\n" in text


def test_versions_agree():
    text = (ROOT / "plugin.yaml").read_text()
    version = re.search(r"^version: (\S+)$", text, re.M).group(1)
    assert client.USER_AGENT.endswith("/" + version) and client.VERSION == version
    assert f'version = "{version}"' in (ROOT / "pyproject.toml").read_text()
