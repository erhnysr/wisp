import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDb } from "./d1-shim";
import { ingestAll, ingestRoom, parsePositiveInt, parseRooms, type D1Like } from "../src/ingest";
import { getTracking, isPruneMinute, pruneTracked, trackDid } from "../src/tracking";
import { didHistory, health } from "../src/api";
import worker from "../src/index";

// Response shapes the assertions read, so the tests stay typed.
interface HistoryBody {
  tracking: { active: boolean; since: string | null; reason?: string };
  totalMessages: number;
  firstSeen: string | null;
  rooms: { room: string; latest: { text: string | null; nonce: string | null; seq: number } }[];
}
interface HealthBody {
  trackedDids: number;
  limits: { maxTracked: number; maxWritesPerPass: number };
  watched: { messagesRead: number; messagesMissed: number; coverage: number | null }[];
}

const A = "did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA";
const B = "did:key:z6MkssNqrErB59cxythR2o44sJPYmHGaZVLGuAhXHuSXx1dZ";
const NOW = new Date("2026-10-02T12:00:00Z");
const DAY = 86_400_000;

// Distinct, well-formed did:key strings for traffic tests (base58 alphabet, 44 chars).
function syntheticDid(i: number): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let tail = "";
  for (let n = i, k = 0; k < 6; k++, n = Math.floor(n / 58)) tail = alphabet[n % 58] + tail;
  return `did:key:z6Mk${"a".repeat(38)}${tail}`;
}

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

const deps = (net: ReturnType<typeof fakeNetwork>, db: D1Like, maxWritesPerPass?: number) => ({
  fetch: net.fetch, db, base: "https://technocore.example", now: () => NOW, maxWritesPerPass,
});

const count = (db: ReturnType<typeof makeDb>, table: string) =>
  (db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

test("parseRooms trims, dedupes and drops blanks", () => {
  assert.deepEqual(parseRooms(" lobby, tclk-offers,,lobby "), ["lobby", "tclk-offers"]);
});

test("parsePositiveInt falls back on anything but a positive integer", () => {
  assert.equal(parsePositiveInt("40", 25), 40);
  for (const bad of [undefined, "", "0", "-3", "2.5", "lots"]) assert.equal(parsePositiveInt(bad, 25), 25);
});

test("first pass indexes signed did:key messages of tracked DIDs, per (did, room)", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW); await trackDid(db, B, NOW);
  net.post("lobby", A); net.post("lobby", A); net.post("lobby", B); net.post("lobby", "anon-nick", false);
  const r = await ingestRoom("lobby", deps(net, db));
  assert.deepEqual([r.read, r.signed, r.signers, r.tracked, r.deferred, r.missed], [4, 3, 2, 2, 0, 0]);
  const h = await didHistory(db, A);
  assert.equal(h.status, 200);
  assert.equal((h.body as HistoryBody).totalMessages, 2);
  assert.equal((h.body as HistoryBody).rooms[0].latest.text, "msg 2");
  assert.equal((h.body as HistoryBody).rooms[0].latest.nonce, "2");
});

test("untracked signers are counted but cost no row writes", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW);
  net.post("lobby", A); net.post("lobby", B); net.post("lobby", B);
  const r = await ingestRoom("lobby", deps(net, db));
  assert.deepEqual([r.signers, r.tracked], [2, 1]);
  assert.equal(count(db, "did_room"), 1);
  assert.equal(((await didHistory(db, B)).body as HistoryBody).rooms.length, 0);
});

test("second pass reads only new messages via since and accumulates counts", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW);
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

test("a busy pass writes at most maxWritesPerPass DID rows plus one cursor per room", async () => {
  const net = fakeNetwork(300); const db = makeDb();
  // 150 distinct signers (more than one 100-parameter membership chunk); every 5th is tracked,
  // spread across both chunks.
  for (let i = 0; i < 150; i++) {
    if (i % 5 === 0) await trackDid(db, syntheticDid(i), NOW);
    net.post("lobby", syntheticDid(i));
  }
  const batches: number[] = [];
  const counting: D1Like = { prepare: (s) => db.prepare(s), batch: (s) => (batches.push(s.length), db.batch(s)) };
  const r = await ingestRoom("lobby", deps(net, counting, 10));
  assert.deepEqual([r.signers, r.tracked, r.deferred], [150, 30, 20]);
  assert.deepEqual(batches, [11]);
  assert.equal(count(db, "did_room"), 10);
});

test("the write cap is shared across rooms within a pass", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW); await trackDid(db, B, NOW);
  net.post("one", A); net.post("two", A); net.post("two", B);
  const [one, two] = await ingestAll(["one", "two"], deps(net, db, 2));
  assert.deepEqual([one.tracked, one.deferred, two.tracked, two.deferred], [1, 0, 2, 1]);
  assert.equal(count(db, "did_room"), 2);
  assert.equal(count(db, "room_cursor"), 2);
});

test("messages that left the ring between passes are counted as missed, not hidden", async () => {
  const net = fakeNetwork(10); const db = makeDb();
  net.post("busy", A);
  await ingestRoom("busy", deps(net, db));            // cursor = 1
  for (let i = 0; i < 25; i++) net.post("busy", B);   // seq 2..26, ring keeps 17..26
  const r = await ingestRoom("busy", deps(net, db));
  assert.equal(r.read, 10);
  assert.equal(r.missed, 15);                          // 2..16 never seen
  const w = ((await health(db, { maxTracked: 1000, maxWritesPerPass: 25 })).body as HealthBody).watched[0];
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

test("a failed store keeps the cursors, so the next pass re-reads what the ring still holds", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW);
  net.post("lobby", A);
  const refusing: D1Like = {
    prepare: (s) => db.prepare(s),
    batch: async () => { throw new Error("D1 daily row write limit"); },
  };
  const [failed] = await ingestAll(["lobby"], deps(net, refusing));
  assert.match(failed.error!, /^store: .*write limit/);
  assert.equal(count(db, "room_cursor"), 0);
  const [retry] = await ingestAll(["lobby"], deps(net, db));
  assert.deepEqual([retry.read, retry.error], [1, undefined]);
  assert.equal(((await didHistory(db, A)).body as HistoryBody).totalMessages, 1);
});

test("watch=1 starts tracking once; repeat lookups within a day write nothing", async () => {
  const db = makeDb();
  const first = await trackDid(db, A, NOW);
  assert.deepEqual(first, { active: true, since: NOW.toISOString() });
  const lookup = () => (db.raw.prepare("SELECT last_lookup FROM watch WHERE did = ?").get(A) as { last_lookup: string }).last_lookup;
  await trackDid(db, A, new Date(NOW.getTime() + DAY / 2));
  assert.equal(lookup(), NOW.toISOString());
  const later = new Date(NOW.getTime() + 2 * DAY);
  assert.deepEqual(await trackDid(db, A, later), { active: true, since: NOW.toISOString() });
  assert.equal(lookup(), later.toISOString());
});

test("a full watch list refuses new DIDs and keeps the tracked ones", async () => {
  const db = makeDb();
  await trackDid(db, A, NOW, 1);
  assert.deepEqual(await trackDid(db, B, NOW, 1), { active: false, since: null, reason: "watchlist-full" });
  assert.equal((await getTracking(db, A)).active, true);
  assert.equal(count(db, "watch"), 1);
});

test("prune drops DIDs nobody looked up for 30 days; their history stays readable", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW);
  net.post("lobby", A);
  await ingestRoom("lobby", deps(net, db));
  await pruneTracked(db, new Date(NOW.getTime() + 29 * DAY));
  assert.equal((await getTracking(db, A)).active, true);
  await pruneTracked(db, new Date(NOW.getTime() + 31 * DAY));
  const body = (await didHistory(db, A)).body as HistoryBody;
  assert.equal(body.tracking.active, false);
  assert.equal(body.totalMessages, 1);
  assert.equal(isPruneMinute(new Date("2026-10-03T03:17:30Z")), true);
  assert.equal(isPruneMinute(new Date("2026-10-03T03:18:00Z")), false);
});

test("worker fetch handler: validates input, tracks on watch=1 only, serves JSON with CORS, rejects writes", async () => {
  const net = fakeNetwork(); const db = makeDb();
  await trackDid(db, A, NOW);
  net.post("lobby", A);
  await ingestRoom("lobby", deps(net, db));
  const env = { DB: db, ROOMS: "lobby", MAX_TRACKED: "5" };
  const ok = await worker.fetch(new Request(`https://idx/did/${encodeURIComponent(A)}`), env);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "*");
  assert.equal(((await ok.json()) as HistoryBody).totalMessages, 1);
  assert.equal((await worker.fetch(new Request("https://idx/did/nope"), env)).status, 400);
  assert.equal((await worker.fetch(new Request("https://idx/health", { method: "POST" }), env)).status, 405);

  const plain = (await (await worker.fetch(new Request(`https://idx/did/${encodeURIComponent(B)}`), env)).json()) as HistoryBody;
  assert.deepEqual([plain.totalMessages, plain.tracking.active], [0, false]);
  const watched = (await (await worker.fetch(new Request(`https://idx/did/${encodeURIComponent(B)}?watch=1`), env)).json()) as HistoryBody;
  assert.equal(watched.tracking.active, true);

  const h = (await (await worker.fetch(new Request("https://idx/health"), env)).json()) as HealthBody;
  assert.equal(h.trackedDids, 2);
  assert.deepEqual(h.limits, { maxTracked: 5, maxWritesPerPass: 25 });
});
