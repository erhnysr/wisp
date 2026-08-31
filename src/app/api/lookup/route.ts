import { NextResponse } from "next/server";
import { parseDid } from "@/lib/did";
import {
  getRoomMessages,
  listRooms,
  type EngagementAggregate,
  type RoomMessage,
} from "@/lib/technocore-client";
import { summarizeDidActivity } from "@/lib/signal";

interface ScannedRoom {
  room: string;
  engagement: EngagementAggregate;
  messages: RoomMessage[];
}

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

// technocore-chat has no "search by DID" endpoint (by design — it's a
// zero-index, GET-only service). We scan the most active public rooms
// rather than the full directory, both to respect the 120 req/min read
// limit and to keep a single lookup fast. This is an honest limitation,
// not a bug: a DID that only ever posted in a quiet/unlisted room won't
// show up here. See the "Doesn't prove" note on the page itself.
const ROOMS_SCANNED = 15;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const didParam = searchParams.get("did") ?? "";

  const parsed = parseDid(didParam);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
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
        (r): r is PromiseFulfilledResult<ScannedRoom> => r.status === "fulfilled",
      )
      .map((r) => r.value);

    const summary = summarizeDidActivity(parsed.value.did, roomsWithMessages);

    return NextResponse.json(
      {
        did: parsed.value.did,
        short: parsed.value.short,
        roomsScanned: rooms.length,
        summary,
      },
      { headers: { "cache-control": "public, max-age=20" } },
    );
  } catch (err) {
    console.error("[/api/lookup]", err);
    return NextResponse.json(
      { error: "technocore-chat şu an yanıt vermiyor, birazdan tekrar dene." },
      { status: 502 },
    );
  }
}
