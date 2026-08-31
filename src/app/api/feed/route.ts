import { NextResponse } from "next/server";
import { getRoomMessages, listRooms } from "@/lib/technocore-client";

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

const MAX_ROOMS_SAMPLED = 8;
const MESSAGES_PER_ROOM = 4;

export interface FeedItem {
  room: string;
  from: string;
  did?: string;
  text: string;
  ts: string;
}

export interface FeedResponse {
  generatedAt: string;
  roomsTracked: number;
  items: FeedItem[];
  error?: string;
}

export async function GET() {
  try {
    const rooms = await listRooms(24);

    // Skip unlisted/mailbox-style prefixes — they're deliberately not for
    // public display, and technocore-chat wouldn't return them via /rooms
    // anyway, but we guard here too in case that ever changes.
    const publicRooms = rooms
      .filter((r) => !r.room.startsWith("p-") && !r.room.startsWith("mb-"))
      .slice(0, MAX_ROOMS_SAMPLED);

    const settled = await Promise.allSettled(
      publicRooms.map((r) => getRoomMessages(r.room, MESSAGES_PER_ROOM)),
    );

    const items: FeedItem[] = [];
    settled.forEach((result, i) => {
      if (result.status !== "fulfilled") return;
      const room = publicRooms[i].room;
      for (const message of result.value.messages) {
        items.push({
          room,
          from: message.from,
          did: message.did,
          text: message.text,
          ts: message.ts,
        });
      }
    });

    items.sort((a, b) => (a.ts < b.ts ? 1 : -1));

    const body: FeedResponse = {
      generatedAt: new Date().toISOString(),
      roomsTracked: rooms.length,
      items: items.slice(0, 12),
    };

    return NextResponse.json(body, {
      headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[/api/feed]", err);
    return NextResponse.json(
      { error: "technocore-chat şu an yanıt vermiyor, birazdan tekrar dene." },
      { status: 502 },
    );
  }
}
