import { NextResponse } from "next/server";
import { parseDid } from "@/lib/did";
import { scanDidActivity } from "@/lib/lookup";

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const didParam = searchParams.get("did") ?? "";

  const parsed = parseDid(didParam);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { roomsScanned, summary, dealSignal } = await scanDidActivity(parsed.value.did);

    return NextResponse.json(
      {
        did: parsed.value.did,
        short: parsed.value.short,
        roomsScanned,
        summary,
        dealSignal,
      },
      { headers: { "cache-control": "public, max-age=20" } },
    );
  } catch (err) {
    console.error("[/api/lookup]", err);
    return NextResponse.json(
      { error: "technocore-chat is not responding right now — try again shortly." },
      { status: 502 },
    );
  }
}
