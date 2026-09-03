import { NextResponse } from "next/server";
import { scanDeals } from "@/lib/tclk-client";
import { computeDealStats, type Deal, type DealStats } from "@/lib/tclk";

export interface DealsResponse {
  generatedAt: string;
  stats: DealStats;
  deals: Deal[];
  error?: string;
}

export async function GET() {
  try {
    const deals = await scanDeals();
    const stats = computeDealStats(deals);

    const body: DealsResponse = {
      generatedAt: new Date().toISOString(),
      stats,
      deals,
    };

    return NextResponse.json(body, {
      headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[/api/deals]", err);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        stats: { total: 0, proposed: 0, accepted: 0, locked: 0, claimed: 0, refunded: 0, cancelled: 0 },
        deals: [],
        error: "Could not read tclk deal data — technocore-chat may be unreachable.",
      } satisfies DealsResponse,
      { status: 502 },
    );
  }
}
