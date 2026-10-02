import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDb } from "./d1-shim";
import { ingestAll, ingestRoom, parseRooms } from "../src/ingest";
import { didHistory, health } from "../src/api";
import worker from "../src/index";

// Response shapes the assertions read, so the tests stay typed.
interface HistoryBody {
  totalMessages: number;
  firstSeen: string | null;
  rooms: { latest: { text: string | null; nonce: string | null; seq: number } }[];
}
interface HealthBody {
  watched: { messagesRead: number; messagesMissed: number; coverage: number | null }[];
}

const A = "did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA";
const B = "did:key:z6MkssNqrErB59cxythR2o44sJPYmHGaZVLGuAhXHuSXx1dZ";

// A fake technocore-chat room ring: keeps the newest `ring` messages, serves `since`/`limit`
// exactly like store.read_messages (newest `limit` with seq > since, oldest first).
function fakeNetwork(ring = 50) {
  const rooms = new Map<string, { seq: number; from: string; text: string; ts: string; nonce?: string; sig?: string }[]>();
  let seq = 0;
  const calls: string[] = [];
  return {
    calls,
    post(room: string, from: string, signed = true) {
      seq++;
      const list = rooms.get(room) ?? [];
      list.push({ seq, from, text: `msg ${seq}`, ts: new Date(1_790_000_000_000 + seq * 1000).toISOString(), ...(signed ? { nonce: String(seq), sig: "s".repeat(86) } : {}) });
      rooms.set(room, list.slice(-ring));
    },
    fetch: (async (input: string) => {
      calls.push(input);
      const u = new URL(input);
      const room = decodeURIComponent(u.pathname.slice(3));
      const list = rooms.get(room);
      if (!list) return new Response("no room", { status: 404 });
      const since = u.searchParams.has("since") ? Number(u.searchParams.get("since")) : -1;
      const limit = Number(u.searchParams.get("limit"));
      const out = list.filter((m) => m.seq > since).slice(-limit);
      return Response.json({ messages: out, first_seq: out[0]?.seq ?? null, last_seq: out.at(-1)?.seq ?? since, generation: 1 });
    }) as unknown as typeof fetch,
  };
}

const deps = (net: ReturnType<typeof fakeNetwork>, db: ReturnType<typeof makeDb>) => ({
  fetch: net.fetch, db, base: "https://technocore.example", now: () => new Date("2026-10-02T12:00:00Z"),
});

test("parseRooms trims, dedupes and drops blanks", () => {
  assert.deepEqual(parseRooms(" lobby, tclk-offers,,lobby "), ["lobby", "tclk-offers"]);
});

test("first pass indexes signed did:key messages only, per (did, room)", async () => {
  const net = fakeNetwork(); const db = makeDb();
  net.post("lobby", A); net.post("lobby", A); net.post("lobby", B); net.post("lobby", "anon-nick", false);
  const r = await ingestRoom("lobby", deps(net, db));
  assert.deepEqual([r.read, r.signed, r.signers, r.missed], [4, 3, 2, 0]);
  const h = await didHistory(db, A);
  assert.equal(h.status, 200);
  assert.equal((h.body as HistoryBody).totalMessages, 2);
  assert.equal((h.body as HistoryBody).rooms[0].latest.text, "msg 2");
  assert.equal((h.body as HistoryBody).rooms[0].latest.nonce, "2");
});

test("second pass reads only new messages via since and accumulates counts", async () => {
  const net = fakeNetwork(); const db = makeDb();
  net.post("lobby", A);
  await ingestRoom("lobby", deps(net, db));
  net.post("lobby", A); net.post("lobby", A);
  const r = await ingestRoom("lobby", deps(net, db));
  assert.equal(r.read, 2);
  assert.match(net.calls.at(-1)!, /since=1/);
  const body = (await didHistory(db, A)).body as HistoryBody;
  assert.equal(body.totalMessages, 3);
  assert.equal(body.rooms[0].latest.seq, 3);
  assert.equal(body.firstSeen, new Date(1_790_000_001_000).toISOString());
});

test("messages that left the ring between passes are counted as missed, not hidden", async () => {
  const net = fakeNetwork(10); const db = makeDb();
  net.post("busy", A);
  await ingestRoom("busy", deps(net, db));            // cursor = 1
  for (let i = 0; i < 25; i++) net.post("busy", B);   // seq 2..26, ring keeps 17..26
  const r = await ingestRoom("busy", deps(net, db));
  assert.equal(r.read, 10);
  assert.equal(r.missed, 15);                          // 2..16 never seen
  const w = ((await health(db)).body as HealthBody).watched[0];
  assert.equal(w.messagesRead, 11);
  assert.equal(w.messagesMissed, 15);
  assert.equal(w.coverage, Math.round((11 / 26) * 10000) / 10000);
});

test("an empty pass advances nothing and a missing room is not an error", async () => {
  const net = fakeNetwork(); const db = makeDb();
  net.post("lobby", A);
  await ingestRoom("lobby", deps(net, db));
  const again = await ingestRoom("lobby", deps(net, db));
  assert.deepEqual([again.read, again.missed], [0, 0]);
  const gone = await ingestRoom("nope", deps(net, db));
  assert.deepEqual([gone.read, gone.error], [0, undefined]);
});

test("one failing room does not stop the others", async () => {
  const net = fakeNetwork(); const db = makeDb();
  net.post("lobby", A);
  const failing = (async (u: string) => (u.includes("/r/broken") ? new Response("x", { status: 503 }) : net.fetch(u))) as unknown as typeof fetch;
  const results = await ingestAll(["broken", "lobby"], { ...deps(net, db), fetch: failing });
  assert.match(results[0].error!, /503/);
  assert.equal(results[1].signed, 1);
});

test("worker fetch handler: /did validates input, serves JSON with CORS, rejects writes", async () => {
  const net = fakeNetwork(); const db = makeDb();
  net.post("lobby", A);
  await ingestRoom("lobby", deps(net, db));
  const env = { DB: db, ROOMS: "lobby" };
  const ok = await worker.fetch(new Request(`https://idx/did/${encodeURIComponent(A)}`), env);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "*");
  assert.equal(((await ok.json()) as HistoryBody).totalMessages, 1);
  assert.equal((await worker.fetch(new Request("https://idx/did/nope"), env)).status, 400);
  assert.equal((await worker.fetch(new Request("https://idx/health", { method: "POST" }), env)).status, 405);
  const unknown = await worker.fetch(new Request(`https://idx/did/${encodeURIComponent(B)}`), env);
  assert.equal(((await unknown.json()) as HistoryBody).totalMessages, 0);
});
