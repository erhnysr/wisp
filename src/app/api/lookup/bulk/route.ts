import { NextResponse } from "next/server";
import { parseDid } from "@/lib/did";
import { scanBulkDidActivity, BULK_MAX_DIDS } from "@/lib/lookup";
import type { SignalSummary, DealSignal } from "@/lib/signal";

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

export interface BulkLookupResultOk {
  did: string;
  short: string;
  ok: true;
  roomsScanned: number;
  summary: SignalSummary;
  dealSignal: DealSignal;
}

export interface BulkLookupResultError {
  did: string;
  ok: false;
  error: string;
}

export type BulkLookupResult = BulkLookupResultOk | BulkLookupResultError;

export interface BulkLookupResponse {
  roomsScanned: number;
  results: BulkLookupResult[];
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const dids = (body as { dids?: unknown } | null)?.dids;
  if (!Array.isArray(dids) || dids.some((d) => typeof d !== "string")) {
    return NextResponse.json({ error: '"dids" must be an array of strings.' }, { status: 400 });
  }

  const rawDids = dids as string[];
  if (rawDids.length === 0) {
    return NextResponse.json({ error: "Provide at least one DID." }, { status: 400 });
  }
  if (rawDids.length > BULK_MAX_DIDS) {
    return NextResponse.json(
      { error: `Too many DIDs — max ${BULK_MAX_DIDS} per request.` },
      { status: 400 },
    );
  }

  // Validate up front; dedupe so a repeated DID isn't scanned twice.
  const seen = new Set<string>();
  const validDids: string[] = [];
  const errorResults: BulkLookupResultError[] = [];

  for (const raw of rawDids) {
    const parsed = parseDid(raw);
    if (!parsed.ok) {
      errorResults.push({ did: raw, ok: false, error: parsed.error });
      continue;
    }
    if (seen.has(parsed.value.did)) continue;
    seen.add(parsed.value.did);
    validDids.push(parsed.value.did);
  }

  try {
    const scanned = validDids.length > 0 ? await scanBulkDidActivity(validDids) : [];
    const okResults: BulkLookupResultOk[] = scanned.map((r) => {
      const parsed = parseDid(r.did);
      const short = parsed.ok ? parsed.value.short : r.did;
      return { did: r.did, short, ok: true, roomsScanned: r.roomsScanned, summary: r.summary, dealSignal: r.dealSignal };
    });

    const roomsScanned = scanned[0]?.roomsScanned ?? 0;

    // Preserve caller order where possible: valid results first (scan order),
    // then any validation errors.
    const body: BulkLookupResponse = {
      roomsScanned,
      results: [...okResults, ...errorResults],
    };

    return NextResponse.json(body, { headers: { "cache-control": "public, max-age=20" } });
  } catch (err) {
    console.error("[/api/lookup/bulk]", err);
    return NextResponse.json(
      { error: "technocore-chat is not responding right now — try again shortly." },
      { status: 502 },
    );
  }
}
