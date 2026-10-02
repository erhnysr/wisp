/**
 * Client for wisp-indexer (see /indexer): the per-DID history that technocore-chat's room
 * rings drop. Optional — when WISP_INDEXER_URL is unset, lookups simply carry no history.
 *
 * The index is a third party to the data it serves, so nothing it returns is taken on trust:
 * each room's latest message is re-verified here against the DID's own Ed25519 key over the
 * exact string technocore-chat's signed lane signs, `<room>|<nonce>|<text>`. Counts and dates
 * are the indexer's; a "verified" mark is cryptographic.
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { parseDid } from "./did";

export interface IndexedRoom {
  room: string;
  messages: number;
  firstSeen: string;
  lastSeen: string;
  latest: { seq: number; nonce: string | null; sig: string | null; text: string | null };
  /** true/false after an Ed25519 check; null when the row carries no signature to check. */
  verified: boolean | null;
}

export interface WatchedRoom {
  room: string;
  indexedSince: string;
  lastPolledAt: string;
  polls: number;
  messagesRead: number;
  messagesMissed: number;
  coverage: number | null;
}

/** Whether the indexer records this DID's new activity, and since when. */
export interface IndexedTracking {
  active: boolean;
  since: string | null;
  reason?: "watchlist-full";
}

export interface IndexedHistory {
  did: string;
  /** null from an indexer older than v0.2, which recorded every signer. */
  tracking: IndexedTracking | null;
  totalMessages: number;
  firstSeen: string | null;
  lastSeen: string | null;
  rooms: IndexedRoom[];
  watched: WatchedRoom[];
  source: string;
}

function base64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function verifyRoomMessage(
  publicKey: Uint8Array,
  room: string,
  latest: IndexedRoom["latest"],
): boolean | null {
  if (!latest.sig || latest.nonce === null || latest.text === null) return null;
  try {
    const payload = new TextEncoder().encode(`${room}|${latest.nonce}|${latest.text}`);
    return ed25519.verify(base64urlToBytes(latest.sig), payload, publicKey);
  } catch {
    return false;
  }
}

export async function getIndexedHistory(did: string): Promise<IndexedHistory | null> {
  const base = process.env.WISP_INDEXER_URL?.replace(/\/$/, "");
  if (!base) return null;
  const parsed = parseDid(did);
  if (!parsed.ok) return null;

  try {
    // watch=1: the indexer records only DIDs someone has looked up, so a lookup here is what
    // starts its history for this DID (one row, once; capped on the indexer's side).
    const res = await fetch(`${base}/did/${encodeURIComponent(did)}?watch=1`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const body = (await res.json()) as Omit<IndexedHistory, "source" | "rooms" | "tracking"> & {
      rooms: Omit<IndexedRoom, "verified">[];
      tracking?: IndexedTracking;
    };
    if (body.did !== did) return null;
    return {
      ...body,
      tracking: body.tracking ?? null,
      rooms: body.rooms.map((r) => ({
        ...r,
        verified: verifyRoomMessage(parsed.value.publicKey, r.room, r.latest),
      })),
      source: base,
    };
  } catch {
    return null;
  }
}
