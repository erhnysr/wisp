import { NextResponse } from "next/server";
import { scanDeals, scanDealsByDid } from "@/lib/tclk-client";
import type { Deal } from "@/lib/tclk";

// Note: this Next.js version deprecates the "edge" runtime export in favor
// of the default Node.js runtime, which is what we use here.

const MAX_ENTRIES = 50;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shortDid(did: string): string {
  const key = did.replace("did:key:", "");
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function entryFor(deal: Deal, siteUrl: string): string {
  const id = deal.contractId ?? deal.offerId;
  const link = `${siteUrl}/deals/${encodeURIComponent(id)}`;
  const title = `${shortDid(deal.offerer)} → ${deal.accepter ? shortDid(deal.accepter) : "?"} — ${deal.state} (${deal.amount} ${deal.asset})`;
  const summary = [
    `State: ${deal.state}.`,
    `Offerer: ${deal.offerer}.`,
    deal.accepter ? `Accepter: ${deal.accepter}.` : "Not yet accepted.",
    `Amount: ${deal.amount} ${deal.asset}.`,
    deal.lockedRail ? `Rail: ${deal.lockedRail}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `  <entry>
    <id>${xmlEscape(`${siteUrl}/deals/${encodeURIComponent(id)}#${deal.state}-${deal.lastUpdate}`)}</id>
    <title>${xmlEscape(title)}</title>
    <link href="${xmlEscape(link)}" />
    <updated>${new Date(deal.lastUpdate).toISOString()}</updated>
    <summary>${xmlEscape(summary)}</summary>
    <category term="${xmlEscape(deal.state)}" />
  </entry>`;
}

/**
 * Atom feed of tclk deal state changes — the subscribe-not-poll channel
 * for agents that would otherwise hit /api/deals or /api/lookup on a
 * timer. One entry per deal, at its current state; `?did=` scopes the
 * feed to a single DID's deals (as offerer or accepter).
 *
 * This is a computed snapshot on every request, not a persisted event
 * log — technocore-chat itself has no push mechanism, so "subscribe"
 * means "point a feed reader/cron at a stable URL" rather than a true
 * webhook callback. Still spares pollers from re-deriving deal state
 * from raw room messages themselves.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const siteUrl = origin;
  const did = searchParams.get("did");
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_ENTRIES)
      : MAX_ENTRIES;

  try {
    const deals = did ? await scanDealsByDid(did) : await scanDeals();

    const sorted = [...deals].sort(
      (a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime(),
    );
    const entries = sorted.slice(0, limit);

    const feedTitle = did ? `Wisp — tclk deals for ${shortDid(did)}` : "Wisp — tclk deal activity";
    const feedId = did ? `${siteUrl}/api/deals/feed.xml?did=${encodeURIComponent(did)}` : `${siteUrl}/api/deals/feed.xml`;
    const updated = entries[0] ? new Date(entries[0].lastUpdate).toISOString() : new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${xmlEscape(feedId)}</id>
  <title>${xmlEscape(feedTitle)}</title>
  <subtitle>Deal offers, locks, claims, refunds and cancellations on the Technocore network — read from public tclk/1 frames, no key ever needed.</subtitle>
  <link href="${xmlEscape(feedId)}" rel="self" />
  <link href="${xmlEscape(did ? `${siteUrl}/card/${encodeURIComponent(did)}` : `${siteUrl}/deals`)}" />
  <updated>${updated}</updated>
${entries.map((d) => entryFor(d, siteUrl)).join("\n")}
</feed>
`;

    return new NextResponse(xml, {
      headers: {
        "content-type": "application/atom+xml; charset=utf-8",
        "cache-control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/deals/feed.xml]", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(new URL(request.url).origin)}/api/deals/feed.xml</id><title>Wisp — tclk deal activity</title><updated>${new Date().toISOString()}</updated></feed>`,
      { status: 502, headers: { "content-type": "application/atom+xml; charset=utf-8" } },
    );
  }
}
