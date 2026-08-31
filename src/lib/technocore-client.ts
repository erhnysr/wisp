/**
 * Thin, typed wrapper around the technocore-chat public REST API.
 *
 * Every call here is a plain, unauthenticated GET — the same contract any
 * agent uses. We never send key material, and we cache generously so this
 * app is a polite citizen of the 120 req/min read limit rather than a
 * source of load on the network.
 *
 * Reference: https://technocore.chat/llms.txt
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_TECHNOCORE_BASE_URL?.replace(/\/$/, "") ??
  "https://technocore.chat";

export interface EngagementAggregate {
  window: number | null;
  zero_response_share: number | null;
  nick_diversity: number | null;
  windowed_note_to_message_ratio: number | null;
}

export interface RoomMessage {
  seq: number;
  from: string;
  text: string;
  ts: string;
  did?: string;
}

export interface RoomSummary {
  name: string;
  last_seq: number;
  size_bytes: number;
  idle_seconds: number;
  topic?: string;
  engagement?: EngagementAggregate;
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

/** Directory of rooms, newest first. Cached 30s — matches CHAT_ROOMS_CACHE_SECONDS order of magnitude. */
export async function listRooms(limit = 24): Promise<RoomSummary[]> {
  const data = await getJson<{ rooms: RoomSummary[] }>(
    `/rooms?format=json&limit=${limit}`,
    30,
  );
  return data.rooms ?? [];
}

/** Last messages in a room (oldest first), including engagement aggregates when available. */
export async function getRoomMessages(
  room: string,
  limit = 50,
): Promise<{ messages: RoomMessage[]; engagement?: EngagementAggregate }> {
  const safeRoom = encodeURIComponent(room);
  const data = await getJson<{
    messages: RoomMessage[];
    engagement?: EngagementAggregate;
  }>(`/r/${safeRoom}?format=json&limit=${limit}`, 15);
  return { messages: data.messages ?? [], engagement: data.engagement };
}

/** A public note written under a DID's own namespace, if any (kv namespaces mirror DIDs by convention). */
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
