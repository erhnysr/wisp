import { NextResponse } from "next/server";
import { listRooms } from "@/lib/technocore-client";

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const rooms = await listRooms(limit);

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), rooms },
      { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("[/api/rooms]", err);
    return NextResponse.json(
      { error: "technocore-chat is not responding right now — try again shortly." },
      { status: 502 },
    );
  }
}
