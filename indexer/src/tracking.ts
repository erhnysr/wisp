/**
 * The watch list: which DIDs the indexer records. A DID joins the first time someone looks it
 * up with `?watch=1` and leaves after TRACK_TTL_DAYS without a lookup, so the list follows what
 * people actually ask about, and it is capped (MAX_TRACKED) so lookups alone cannot grow it
 * without bound.
 */

import type { D1Like } from "./ingest";

export const DEFAULT_MAX_TRACKED = 1000;
export const TRACK_TTL_DAYS = 30;
const DAY_MS = 86_400_000;

export interface Tracking {
  /** Whether new activity from this DID is being recorded. */
  active: boolean;
  /** When recording started (ISO 8601), or null when it is not tracked. */
  since: string | null;
  reason?: "watchlist-full";
}

interface WatchRow {
  added_at: string;
  last_lookup: string;
}

const SELECT_ONE = "SELECT added_at, last_lookup FROM watch WHERE did = ?";

export async function getTracking(db: D1Like, did: string): Promise<Tracking> {
  const row = await db.prepare(SELECT_ONE).bind(did).first<WatchRow>();
  return row ? { active: true, since: row.added_at } : { active: false, since: null };
}

export async function trackDid(
  db: D1Like,
  did: string,
  now: Date,
  maxTracked = DEFAULT_MAX_TRACKED,
): Promise<Tracking> {
  const nowIso = now.toISOString();
  const row = await db.prepare(SELECT_ONE).bind(did).first<WatchRow>();
  if (row) {
    // Lookups repeat freely; refresh the lookup date at most once a day so they cost no writes.
    if (Date.parse(row.last_lookup) <= now.getTime() - DAY_MS) {
      await db.prepare("UPDATE watch SET last_lookup = ? WHERE did = ?").bind(nowIso, did).run();
    }
    return { active: true, since: row.added_at };
  }
  if ((await countTracked(db)) >= maxTracked) {
    return { active: false, since: null, reason: "watchlist-full" };
  }
  await db
    .prepare("INSERT INTO watch (did, added_at, last_lookup) VALUES (?, ?, ?) ON CONFLICT (did) DO NOTHING")
    .bind(did, nowIso, nowIso)
    .run();
  return { active: true, since: nowIso };
}

export async function countTracked(db: D1Like): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM watch").first<{ n: number }>();
  return row?.n ?? 0;
}

/** Stop recording DIDs nobody has looked up for `ttlDays`. What was indexed stays readable. */
export async function pruneTracked(db: D1Like, now: Date, ttlDays = TRACK_TTL_DAYS): Promise<void> {
  const cutoff = new Date(now.getTime() - ttlDays * DAY_MS).toISOString();
  await db.prepare("DELETE FROM watch WHERE last_lookup < ?").bind(cutoff).run();
}

/** The cron fires every minute; housekeeping only needs one of them a day. */
export function isPruneMinute(now: Date): boolean {
  return now.getUTCHours() === 3 && now.getUTCMinutes() === 17;
}
