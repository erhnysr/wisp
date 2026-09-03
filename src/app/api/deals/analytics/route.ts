import { NextResponse } from "next/server";
import { scanDeals } from "@/lib/tclk-client";
import { computeNetworkPulse, type NetworkPulse } from "@/lib/tclk";

export interface AnalyticsResponse {
  generatedAt: string;
  pulse: NetworkPulse;
  error?: string;
}

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

export async function GET() {
  try {
    const deals = await scanDeals();
    const pulse = computeNetworkPulse(deals);

    const body: AnalyticsResponse = {
      generatedAt: new Date().toISOString(),
      pulse,
    };

    return NextResponse.json(body, {
      headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[/api/deals/analytics]", err);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        pulse: {
          avgClaimDurationMs: null,
          medianClaimDurationMs: null,
          claimedSampleSize: 0,
          topDids: [],
          volumeByDay: [],
        },
        error: "Could not read tclk deal data — technocore-chat may be unreachable.",
      } satisfies AnalyticsResponse,
      { status: 502 },
    );
  }
}
