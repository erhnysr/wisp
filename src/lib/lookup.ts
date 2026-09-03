/**
 * Shared DID → signal scan, used by both /api/lookup (JSON, for the
 * interactive panel) and /api/card (image, for the shareable card). Kept
 * in one place so the card can never show numbers the JSON panel wouldn't
 * also produce for the same DID.
 */

import { getRoomMessages, listRooms, type EngagementAggregate, type RoomMessage, type RoomSummary } from "./technocore-client";
import { summarizeDidActivity, summarizeDealActivity, type SignalSummary, type DealSignal } from "./signal";
import { scanDeals, scanDealsByDid } from "./tclk-client";
import type { Deal } from "./tclk";

// See the comment in the old /api/lookup route: technocore-chat has no
// "search by DID" endpoint, so we scan the most active public rooms rather
// than the full directory. Honest limitation, not a bug.
export const ROOMS_SCANNED = 15;

/** Bulk lookups are capped to stay a polite citizen of the read rate limit. */
export const BULK_MAX_DIDS = 25;

interface RoomWithMessages {
  room: string;
  engagement: EngagementAggregate;
  messages: RoomMessage[];
}

/** Fetches the active room set plus each room's recent messages, once. */
async function scanRoomsWithMessages(): Promise<{
  rooms: RoomSummary[];
  roomsWithMessages: RoomWithMessages[];
}> {
  const rooms = await listRooms(ROOMS_SCANNED);
  const settled = await Promise.allSettled(
    rooms.map(async (r) => ({
      room: r.room,
      engagement: r.engagement,
      ...(await getRoomMessages(r.room, 200)),
    })),
  );

  const roomsWithMessages = settled
    .filter(
      (r): r is PromiseFulfilledResult<RoomWithMessages> => r.status === "fulfilled",
    )
    .map((r) => r.value);

  return { rooms, roomsWithMessages };
}

export async function scanDidActivity(did: string): Promise<{
  roomsScanned: number;
  summary: SignalSummary;
  dealSignal: DealSignal;
}> {
  // Fetch room activity and deal data in parallel
  const [roomData, didDeals] = await Promise.all([
    scanRoomsWithMessages(),
    scanDealsByDid(did).catch(() => [] as Deal[]),
  ]);

  return {
    roomsScanned: roomData.rooms.length,
    summary: summarizeDidActivity(did, roomData.roomsWithMessages),
    dealSignal: summarizeDealActivity(did, didDeals),
  };
}

/**
 * Same scan as `scanDidActivity`, but for many DIDs at once — rooms,
 * messages, and deals are each fetched exactly once and reused across
 * every DID, instead of re-scanning the network per identifier. This is
 * what makes bulk lookup a single polite pass rather than N separate ones.
 */
export async function scanBulkDidActivity(dids: string[]): Promise<
  Array<{
    did: string;
    roomsScanned: number;
    summary: SignalSummary;
    dealSignal: DealSignal;
  }>
> {
  const [roomData, allDeals] = await Promise.all([
    scanRoomsWithMessages(),
    scanDeals().catch(() => [] as Deal[]),
  ]);

  return dids.map((did) => ({
    did,
    roomsScanned: roomData.rooms.length,
    summary: summarizeDidActivity(did, roomData.roomsWithMessages),
    dealSignal: summarizeDealActivity(
      did,
      allDeals.filter((d) => d.offerer === did || d.accepter === did),
    ),
  }));
}
