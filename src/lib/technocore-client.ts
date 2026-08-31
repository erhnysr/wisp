/**
 * Thin, typed wrapper around the technocore-chat public REST API.
 *
 * Every call here is a plain, unauthenticated GET — the same contract any
 * agent uses. We never send key material, and we cache generously so this
 * app is a polite citizen of the 120 req/min read limit rather than a
 * source of load on the network.
 *
 * Shapes below were confirmed against the live API on 2026-08-31 (not just
 * the docs) — see `/rooms?format=json` and `/r/<room>?format=json`.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_TECHNOCORE_BASE_URL?.replace(/\/$/, "") ??
  "https://technocore.chat";

/** A room's engagement numbers, as returned inline on each entry of `/rooms`. */
export interface EngagementAggregate {
  /** Message count the ratios below were computed over. Null when the window was empty. */
  window: number | null;
  zero_response_share: number | null;
  nick_diversity: number | null;
  /**
   * technocore-chat documents this as a "rollup only" figure — it isn't
   * present on the public `/rooms` or `/r/<room>` responses we read, so it
   * always comes back null here. Kept in the type so the UI already knows
   * how to show it if a future API version starts returning it.
   */
  windowed_note_to_message_ratio: number | null;
}

export interface RoomMessage {
  seq: number;
  /** For signed messages this IS the did:key — technocore-chat has no separate `did` field. */
  from: string;
  text: string;
  ts: string;
  nonce?: number;
  sig?: string;
  /** Convenience: `from` when `sig` is present, otherwise undefined. */
  did?: string;
}

export interface RoomSummary {
  room: string;
  last_seq: number;
  bytes: number;
  idle_seconds: number;
  topic?: string | null;
  engagement: EngagementAggregate;
}

interface RawRoom {
  room: string;
  last_seq: number;
  bytes: number;
  idle_seconds: number;
  topic?: string | null;
  window?: number | null;
  zero_response_share?: number | null;
  nick_diversity?: number | null;
  windowed_note_to_message_ratio?: number | null;
}

interface RawMessage {
  seq: number;
  from: string;
  text: string;
  ts: string;
  nonce?: number;
  sig?: string;
}

async function getJson<T>(path: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`technocore-chat ${res.status} — ${path}`);
  }

  return (await res.json()) as T;
}

function toEngagement(raw: RawRoom): EngagementAggregate {
  return {
    window: raw.window ?? null,
    zero_response_share: raw.zero_response_share ?? null,
    nick_diversity: raw.nick_diversity ?? null,
    windowed_note_to_message_ratio: raw.windowed_note_to_message_ratio ?? null,
  };
}

/** Directory of rooms, newest first (per technocore-chat's own ordering). */
export async function listRooms(limit = 24): Promise<RoomSummary[]> {
  const data = await getJson<{ rooms: RawRoom[] }>(
    `/rooms?format=json&limit=${limit}`,
    30,
  );
  return (data.rooms ?? []).map((r) => ({
    room: r.room,
    last_seq: r.last_seq,
    bytes: r.bytes,
    idle_seconds: r.idle_seconds,
    topic: r.topic,
    engagement: toEngagement(r),
  }));
}

/** Last messages in a room (oldest first). No engagement data on this endpoint. */
export async function getRoomMessages(
  room: string,
  limit = 50,
): Promise<{ messages: RoomMessage[] }> {
  const safeRoom = encodeURIComponent(room);
  const data = await getJson<{ messages: RawMessage[] }>(
    `/r/${safeRoom}?format=json&limit=${limit}`,
    15,
  );
  const messages: RoomMessage[] = (data.messages ?? []).map((m) => ({
    seq: m.seq,
    from: m.from,
    text: m.text,
    ts: m.ts,
    nonce: m.nonce,
    sig: m.sig,
    did: m.sig ? m.from : undefined,
  }));
  return { messages };
}

/** A public note written under a namespace, if any. */
export async function getNote(namespace: string, key: string): Promise<string | null> {
  const res = await fetch(
    `${BASE_URL}/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    { next: { revalidate: 60 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`technocore-chat ${res.status} — /kv`);
  return await res.text();
}

export { BASE_URL as TECHNOCORE_BASE_URL };
