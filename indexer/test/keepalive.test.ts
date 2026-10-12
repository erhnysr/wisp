import { test } from "node:test";
import assert from "node:assert/strict";
import { isKeepaliveMinute, keepNotesAlive, parseKeepalive } from "../src/keepalive";
import worker from "../src/index";
import { makeDb } from "./d1-shim";

const PROFILE = "technocore-profile-v1 did:did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA agent:erhan_agent";
const CONFIG = JSON.stringify({ "/kv/did-31/82549297720aac": PROFILE, "/kv/contrib/3182549297720aac": "technocore-contribution-v1 type:tool" });

test("parseKeepalive: off when unset, entries in order when valid", () => {
  assert.deepEqual(parseKeepalive(undefined), []);
  assert.deepEqual(parseKeepalive("  "), []);
  assert.deepEqual(parseKeepalive(CONFIG).map(([p]) => p), ["/kv/did-31/82549297720aac", "/kv/contrib/3182549297720aac"]);
});

test("parseKeepalive refuses configs that would write somewhere else or something else", () => {
  for (const bad of [
    "[]",
    "not json",
    JSON.stringify({ "/r/lobby/say/hi": "x" }),          // not a note path
    JSON.stringify({ "/kv/did-31/../x": "x" }),          // traversal / bad name
    JSON.stringify({ "/kv/Upper/key": "x" }),             // technocore names are lowercase
    JSON.stringify({ "/kv/a/b": "" }),
    JSON.stringify({ "/kv/a/b": 5 }),
    JSON.stringify({ "/kv/a/b": "two\nlines" }),
    JSON.stringify({ "/kv/a/b": "x".repeat(8193) }),
    JSON.stringify(Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`/kv/a/k${i}`, "x"]))),
  ]) {
    assert.throws(() => parseKeepalive(bad), Error, bad.slice(0, 40));
  }
});

test("keepNotesAlive writes each configured value through the note lane and reports failures", async () => {
  const calls: string[] = [];
  const fetchStub = (async (url: string) => {
    calls.push(url);
    return new Response("ok", { status: url.includes("/contrib/") ? 503 : 200 });
  }) as unknown as typeof fetch;
  const results = await keepNotesAlive(parseKeepalive(CONFIG), { fetch: fetchStub, base: "https://technocore.example" });
  assert.equal(calls[0], `https://technocore.example/kv/did-31/82549297720aac/set/${encodeURIComponent(PROFILE)}`);
  assert.deepEqual(results.map((r) => [r.ok, r.status]), [[true, 200], [false, 503]]);
});

test("keepNotesAlive survives a network error on one note", async () => {
  let n = 0;
  const flaky = (async () => { if (n++ === 0) throw new Error("reset"); return new Response("ok"); }) as unknown as typeof fetch;
  const results = await keepNotesAlive(parseKeepalive(CONFIG), { fetch: flaky, base: "https://t" });
  assert.deepEqual(results.map((r) => r.ok), [false, true]);
  assert.match(results[0].error!, /reset/);
});

test("isKeepaliveMinute fires four times a day", () => {
  const fires = [];
  for (let m = 0; m < 24 * 60; m++) if (isKeepaliveMinute(new Date(Date.UTC(2026, 9, 12, 0, m)))) fires.push(m);
  assert.deepEqual(fires, [41, 401, 761, 1121]);
});

test("the scheduled handler re-asserts the notes at a keepalive minute and only then", async () => {
  const db = makeDb();
  const writes: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string) => {
    const url = String(input);
    if (url.includes("/kv/")) { writes.push(url); return new Response("ok"); }
    return new Response("no room", { status: 404 });
  }) as unknown as typeof fetch;
  try {
    const env = { DB: db, ROOMS: "lobby", TECHNOCORE_BASE_URL: "https://technocore.example", KEEPALIVE_NOTES: CONFIG };
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 9, 12, 7, 41) }, env);
    assert.equal(writes.length, 0);
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 9, 12, 6, 41) }, env);
    assert.equal(writes.length, 2);
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 9, 12, 12, 41) }, { ...env, KEEPALIVE_NOTES: "{broken" });
    assert.equal(writes.length, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});
