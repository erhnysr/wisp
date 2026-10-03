/**
 * One indexing pass: read what is new in each watched room since the last pass and fold the
 * signed messages of tracked DIDs (see tracking.ts) into per-(did, room) rows.
 *
 * Pure with respect to its inputs (a fetch function, a D1-shaped database, a clock), so the
 * same code runs in the Worker's cron handler and in the tests.
 *
 * technocore-chat returns the newest `limit` (max 200) messages with seq > `since`. When more
 * than that arrived between two passes, the oldest ones are gone from the room ring before we
 * can read them; the gap is counted in `missed` instead of being hidden, so coverage is a
 * number the API reports rather than an assumption.
 *
 * Write budget: a pass writes one cursor row per room plus at most `maxWritesPerPass` did_room
 * rows, however busy the rooms are. Untracked signers cost reads, never writes.
 */

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

interface RoomMessage {
  seq: number;
  from: string;
  text: string;
  ts: string;
  nonce?: number | string;
  sig?: string;
}

interface RoomRead {
  messages?: RoomMessage[];
  first_seq?: number | null;
  last_seq?: number | null;
  generation?: number | null;
}

interface Cursor {
  room: string;
  last_seq: number;
  generation: number | null;
}

export interface RoomResult {
  room: string;
  read: number;
  signed: number;
  signers: number;
  /** Signers in this read that are on the watch list. */
  tracked: number;
  /** Tracked signers not written because the pass reached maxWritesPerPass. */
  deferred: number;
  missed: number;
  error?: string;
}

export interface IngestDeps {
  fetch: typeof fetch;
  db: D1Like;
  base: string;
  now: () => Date;
  /** Cap on did_room upserts per pass; DEFAULT_MAX_WRITES_PER_PASS when omitted. */
  maxWritesPerPass?: number;
}

const DID_RE = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const READ_LIMIT = 200;
const MAX_TEXT = 4096; // technocore-chat's own message cap
const MAX_PARAMS = 100; // D1's bound-parameter limit per query

/**
 * 25 upserts a minute is at most 72,000 rows a day (an insert writes the row and its key), and
 * with four cursor rows a minute the whole indexer stays under D1's free 100,000 rows a day.
 */
export const DEFAULT_MAX_WRITES_PER_PASS = 25;

export function parseRooms(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((r) => r.trim()).filter(Boolean))];
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isInteger(n) && n > 0 ? n : fallback;
}

interface Signer {
  count: number;
  first: RoomMessage;
  last: RoomMessage;
}

interface RoomPass {
  messages: RoomMessage[];
  missed: number;
  lastSeq: number;
  generation: number | null;
  byDid: Map<string, Signer>;
}

/**
 * technocore-chat serialises nonces as JSON numbers, and the nanosecond nonces many agents use
 * (19 digits) are past 2^53: JSON.parse would round them, and a signature over
 * `<room>|<nonce>|<text>` only verifies with the exact digits. Quote long nonce values before
 * parsing. Only the top-level `"nonce":` key can match; the same key inside a message's text is
 * escaped (`\"nonce\":`) and left alone.
 */
export function parseRoomRead(raw: string): RoomRead {
  return JSON.parse(raw.replace(/"nonce"\s*:\s*(\d{16,})/g, '"nonce":"$1"')) as RoomRead;
}

async function readRoom(room: string, cursor: Cursor | undefined, deps: IngestDeps): Promise<RoomPass | null> {
  const url = new URL(`${deps.base}/r/${encodeURIComponent(room)}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(READ_LIMIT));
  if (cursor) url.searchParams.set("since", String(cursor.last_seq));

  const res = await deps.fetch(url.toString(), { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const view = parseRoomRead(await res.text());
  const messages = (view.messages ?? []).filter((m) => !cursor || m.seq > cursor.last_seq);

  // Messages that existed between our cursor and the first one we could still read.
  const missed =
    cursor && messages.length > 0 ? Math.max(0, messages[0].seq - cursor.last_seq - 1) : 0;

  const byDid = new Map<string, Signer>();
  for (const m of messages) {
    if (!m.sig || !DID_RE.test(m.from)) continue;
    const entry = byDid.get(m.from);
    if (entry) {
      entry.count++;
      entry.last = m;
    } else {
      byDid.set(m.from, { count: 1, first: m, last: m });
    }
  }

  const lastSeq = Math.max(cursor?.last_seq ?? 0, view.last_seq ?? 0, messages.at(-1)?.seq ?? 0);
  return { messages, missed, lastSeq, generation: view.generation ?? null, byDid };
}

/** Which of `dids` are on the watch list, queried in chunks under D1's parameter limit. */
export async function trackedAmong(db: D1Like, dids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < dids.length; i += MAX_PARAMS) {
    const chunk = dids.slice(i, i + MAX_PARAMS);
    const rows = await db
      .prepare(`SELECT did FROM watch WHERE did IN (${chunk.map(() => "?").join(", ")})`)
      .bind(...chunk)
      .all<{ did: string }>();
    for (const r of rows.results) out.add(r.did);
  }
  return out;
}

const UPSERT_DID_ROOM = `INSERT INTO did_room (did, room, messages, first_seq, last_seq, first_ts, last_ts, last_nonce, last_sig, last_text)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (did, room) DO UPDATE SET
    messages   = did_room.messages + excluded.messages,
    last_seq   = excluded.last_seq,
    last_ts    = excluded.last_ts,
    last_nonce = excluded.last_nonce,
    last_sig   = excluded.last_sig,
    last_text  = excluded.last_text`;

const UPSERT_CURSOR = `INSERT INTO room_cursor (room, last_seq, generation, polls, seen, missed, first_polled_at, updated_at)
  VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  ON CONFLICT (room) DO UPDATE SET
    last_seq   = excluded.last_seq,
    generation = excluded.generation,
    polls      = room_cursor.polls + 1,
    seen       = room_cursor.seen + excluded.seen,
    missed     = room_cursor.missed + excluded.missed,
    updated_at = excluded.updated_at`;

const emptyResult = (room: string): RoomResult => ({
  room, read: 0, signed: 0, signers: 0, tracked: 0, deferred: 0, missed: 0,
});

/** Index every room once. Never throws: failures are reported per room in `error`. */
export async function ingestAll(rooms: string[], deps: IngestDeps): Promise<RoomResult[]> {
  const { db } = deps;
  const results = rooms.map(emptyResult);
  const fail = (err: unknown, prefix = "") => {
    for (const r of results) r.error ??= prefix + String(err);
    return results;
  };

  let cursors: Map<string, Cursor>;
  try {
    const rows = await db.prepare("SELECT room, last_seq, generation FROM room_cursor").all<Cursor>();
    cursors = new Map(rows.results.map((c) => [c.room, c]));
  } catch (err) {
    return fail(err, "store: ");
  }

  // Read every room first, one after another: a polite reader of the shared read budget.
  const passes: (RoomPass | null)[] = [];
  for (const [i, room] of rooms.entries()) {
    try {
      passes.push(await readRoom(room, cursors.get(room), deps));
    } catch (err) {
      passes.push(null);
      results[i].error = String(err);
    }
  }

  try {
    const signers = [...new Set(passes.flatMap((p) => (p ? [...p.byDid.keys()] : [])))];
    const tracked = await trackedAmong(db, signers);
    const nowIso = deps.now().toISOString();
    let budget = deps.maxWritesPerPass ?? DEFAULT_MAX_WRITES_PER_PASS;
    const statements: D1Statement[] = [];

    for (const [i, p] of passes.entries()) {
      if (!p) continue;
      const r = results[i];
      r.read = p.messages.length;
      r.missed = p.missed;
      r.signers = p.byDid.size;
      for (const [did, e] of p.byDid) {
        r.signed += e.count;
        if (!tracked.has(did)) continue;
        r.tracked++;
        if (budget <= 0) {
          r.deferred++;
          continue;
        }
        budget--;
        statements.push(
          db.prepare(UPSERT_DID_ROOM).bind(
            did,
            rooms[i],
            e.count,
            e.first.seq,
            e.last.seq,
            e.first.ts,
            e.last.ts,
            e.last.nonce === undefined ? null : String(e.last.nonce),
            e.last.sig ?? null,
            e.last.text.slice(0, MAX_TEXT),
          ),
        );
      }
      statements.push(
        db.prepare(UPSERT_CURSOR).bind(rooms[i], p.lastSeq, p.generation, p.messages.length, p.missed, nowIso, nowIso),
      );
    }
    // One batch is one transaction: on failure nothing from this pass is stored and the
    // cursors stay put, so the next pass re-reads whatever the rings still hold.
    if (statements.length > 0) await db.batch(statements);
  } catch (err) {
    for (const [i, p] of passes.entries()) if (p) results[i].error = `store: ${String(err)}`;
  }
  return results;
}

/** A single room; the same as `ingestAll([room], deps)`. */
export async function ingestRoom(room: string, deps: IngestDeps): Promise<RoomResult> {
  return (await ingestAll([room], deps))[0];
}
