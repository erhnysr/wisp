/**
 * One indexing pass: read what is new in each watched room since the last pass and fold the
 * signed messages into per-(did, room) rows.
 *
 * Pure with respect to its inputs (a fetch function, a D1-shaped database, a clock), so the
 * same code runs in the Worker's cron handler and in the tests.
 *
 * technocore-chat returns the newest `limit` (max 200) messages with seq > `since`. When more
 * than that arrived between two passes, the oldest ones are gone from the room ring before we
 * can read them; the gap is counted in `missed` instead of being hidden, so coverage is a
 * number the API reports rather than an assumption.
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
  last_seq: number;
  generation: number | null;
}

export interface RoomResult {
  room: string;
  read: number;
  signed: number;
  signers: number;
  missed: number;
  error?: string;
}

const DID_RE = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const READ_LIMIT = 200;
const MAX_TEXT = 4096; // technocore-chat's own message cap

export function parseRooms(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((r) => r.trim()).filter(Boolean))];
}

export async function ingestRoom(
  room: string,
  deps: { fetch: typeof fetch; db: D1Like; base: string; now: () => Date },
): Promise<RoomResult> {
  const { db, base } = deps;
  const cursor = await db
    .prepare("SELECT last_seq, generation FROM room_cursor WHERE room = ?")
    .bind(room)
    .first<Cursor>();

  const url = new URL(`${base}/r/${encodeURIComponent(room)}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(READ_LIMIT));
  if (cursor) url.searchParams.set("since", String(cursor.last_seq));

  const res = await deps.fetch(url.toString(), { headers: { accept: "application/json" } });
  if (res.status === 404) return { room, read: 0, signed: 0, signers: 0, missed: 0 };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const view = (await res.json()) as RoomRead;
  const messages = (view.messages ?? []).filter((m) => !cursor || m.seq > cursor.last_seq);

  // Messages that existed between our cursor and the first one we could still read.
  const missed =
    cursor && messages.length > 0 ? Math.max(0, messages[0].seq - cursor.last_seq - 1) : 0;

  const byDid = new Map<string, { count: number; first: RoomMessage; last: RoomMessage }>();
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

  const nowIso = deps.now().toISOString();
  const lastSeq = Math.max(
    cursor?.last_seq ?? 0,
    view.last_seq ?? 0,
    messages.at(-1)?.seq ?? 0,
  );

  const statements: D1Statement[] = [];
  for (const [did, e] of byDid) {
    statements.push(
      db
        .prepare(
          `INSERT INTO did_room (did, room, messages, first_seq, last_seq, first_ts, last_ts, last_nonce, last_sig, last_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (did, room) DO UPDATE SET
             messages   = did_room.messages + excluded.messages,
             last_seq   = excluded.last_seq,
             last_ts    = excluded.last_ts,
             last_nonce = excluded.last_nonce,
             last_sig   = excluded.last_sig,
             last_text  = excluded.last_text`,
        )
        .bind(
          did,
          room,
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
    db
      .prepare(
        `INSERT INTO room_cursor (room, last_seq, generation, polls, seen, missed, first_polled_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT (room) DO UPDATE SET
           last_seq   = excluded.last_seq,
           generation = excluded.generation,
           polls      = room_cursor.polls + 1,
           seen       = room_cursor.seen + excluded.seen,
           missed     = room_cursor.missed + excluded.missed,
           updated_at = excluded.updated_at`,
      )
      .bind(room, lastSeq, view.generation ?? null, messages.length, missed, nowIso, nowIso),
  );
  await db.batch(statements);

  let signed = 0;
  for (const e of byDid.values()) signed += e.count;
  return { room, read: messages.length, signed, signers: byDid.size, missed };
}

export async function ingestAll(
  rooms: string[],
  deps: { fetch: typeof fetch; db: D1Like; base: string; now: () => Date },
): Promise<RoomResult[]> {
  const results: RoomResult[] = [];
  // Sequential on purpose: a polite reader of the shared read budget, and a cron pass has a
  // minute to finish.
  for (const room of rooms) {
    try {
      results.push(await ingestRoom(room, deps));
    } catch (err) {
      results.push({ room, read: 0, signed: 0, signers: 0, missed: 0, error: String(err) });
    }
  }
  return results;
}
