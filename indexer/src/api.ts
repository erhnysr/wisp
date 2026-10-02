/** Read side of the index: per-DID history and per-room coverage. */

import type { D1Like } from "./ingest";

const DID_RE = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;

interface DidRoomRow {
  room: string;
  messages: number;
  first_seq: number;
  last_seq: number;
  first_ts: string;
  last_ts: string;
  last_nonce: string | null;
  last_sig: string | null;
  last_text: string | null;
}

interface CursorRow {
  room: string;
  last_seq: number;
  polls: number;
  seen: number;
  missed: number;
  first_polled_at: string;
  updated_at: string;
}

function coverage(c: CursorRow) {
  const total = c.seen + c.missed;
  return {
    room: c.room,
    indexedSince: c.first_polled_at,
    lastPolledAt: c.updated_at,
    polls: c.polls,
    messagesRead: c.seen,
    messagesMissed: c.missed,
    coverage: total ? Math.round((c.seen / total) * 10000) / 10000 : null,
  };
}

export async function didHistory(db: D1Like, did: string) {
  if (!DID_RE.test(did)) return { status: 400, body: { error: "expected a did:key:z6Mk… identifier" } };
  const [rows, cursors] = await Promise.all([
    db
      .prepare(
        "SELECT room, messages, first_seq, last_seq, first_ts, last_ts, last_nonce, last_sig, last_text FROM did_room WHERE did = ? ORDER BY last_ts DESC",
      )
      .bind(did)
      .all<DidRoomRow>(),
    db.prepare("SELECT * FROM room_cursor ORDER BY room").all<CursorRow>(),
  ]);
  const rooms = rows.results.map((r) => ({
    room: r.room,
    messages: r.messages,
    firstSeen: r.first_ts,
    lastSeen: r.last_ts,
    // The DID's latest signed message in this room, exactly as technocore-chat served it:
    // verify sig over `${room}|${nonce}|${text}` with the DID's own Ed25519 key.
    latest: { seq: r.last_seq, nonce: r.last_nonce, sig: r.last_sig, text: r.last_text },
  }));
  return {
    status: 200,
    body: {
      did,
      totalMessages: rooms.reduce((n, r) => n + r.messages, 0),
      firstSeen: rooms.reduce<string | null>((m, r) => (!m || r.firstSeen < m ? r.firstSeen : m), null),
      lastSeen: rooms[0]?.lastSeen ?? null,
      rooms,
      watched: cursors.results.map(coverage),
    },
  };
}

export async function health(db: D1Like) {
  const cursors = await db.prepare("SELECT * FROM room_cursor ORDER BY room").all<CursorRow>();
  const dids = await db.prepare("SELECT COUNT(DISTINCT did) AS n FROM did_room").first<{ n: number }>();
  return { status: 200, body: { distinctDids: dids?.n ?? 0, watched: cursors.results.map(coverage) } };
}
