/**
 * Shared DID → signal scan, used by both /api/lookup (JSON, for the
 * interactive panel) and /api/card (image, for the shareable card). Kept
 * in one place so the card can never show numbers the JSON panel wouldn't
 * also produce for the same DID.
 */

import { getRoomMessages, listRooms } from "./technocore-client";
import { summarizeDidActivity, type SignalSummary } from "./signal";

// See the comment in the old /api/lookup route: technocore-chat has no
// "search by DID" endpoint, so we scan the most active public rooms rather
// than the full directory. Honest limitation, not a bug.
export const ROOMS_SCANNED = 15;

export async function scanDidActivity(did: string): Promise<{
  roomsScanned: number;
  summary: SignalSummary;
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
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<typeof getRoomMessages>> & {
          room: string;
          engagement: (typeof rooms)[number]["engagement"];
        }
      > => r.status === "fulfilled",
    )
    .map((r) => r.value);

  return {
    roomsScanned: rooms.length,
    summary: summarizeDidActivity(did, roomsWithMessages),
  };
}
