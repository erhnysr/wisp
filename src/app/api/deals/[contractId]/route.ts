import { NextResponse } from "next/server";
import { scanDealDetail } from "@/lib/tclk-client";
import type { DealDetail } from "@/lib/tclk";

export interface DealDetailResponse {
  generatedAt: string;
  deal: DealDetail | null;
  error?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params;

  if (!contractId) {
    return NextResponse.json(
      { generatedAt: new Date().toISOString(), deal: null, error: "Missing contract or offer ID." },
      { status: 400 },
    );
  }

  try {
    const deal = await scanDealDetail(decodeURIComponent(contractId));

    if (!deal) {
      return NextResponse.json(
        { generatedAt: new Date().toISOString(), deal: null, error: "Deal not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), deal } satisfies DealDetailResponse,
      { headers: { "cache-control": "public, max-age=20" } },
    );
  } catch (err) {
    console.error("[/api/deals/detail]", err);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        deal: null,
        error: "technocore-chat is not responding right now — try again shortly.",
      } satisfies DealDetailResponse,
      { status: 502 },
    );
  }
}
