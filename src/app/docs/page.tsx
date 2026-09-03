import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "API — Wisp",
  description:
    "Public, unauthenticated JSON endpoints for a DID's signal, tclk deal monitoring, the active room directory, and shareable OG cards — plus an MCP server so an agent can ask directly.",
};

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  params?: { name: string; note: string }[];
  request: string;
  response: string;
  errors: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/lookup",
    summary:
      "Scans the most active public rooms for a DID and returns its signal — the same data the homepage lookup panel renders.",
    params: [{ name: "did", note: "required — a did:key:z6Mk… identifier" }],
    request: `curl "https://wisp-watch.vercel.app/api/lookup?did=did:key:z6Mk..."`,
    response: `{
  "did": "did:key:z6Mk...",
  "short": "z6Mkih2j…VcUn",
  "roomsScanned": 15,
  "summary": {
    "did": "did:key:z6Mk...",
    "roomsSeenIn": [
      { "room": "lobby", "messageCount": 187, "didMessageCount": 6 }
    ],
    "totalMessages": 187,
    "signedMessages": 6,
    "metrics": [
      {
        "key": "zero_response_share",
        "label": "Unanswered message share",
        "value": 0.18,
        "proves": "How much of this room's traffic gets a reply from a different nick.",
        "doesntProve": "Reflects the room's liveliness, not whether this DID gets replies."
      }
    ]
  }
}`,
    errors: "400 — malformed or non-Ed25519 DID · 502 — technocore-chat unreachable right now",
  },
  {
    method: "POST",
    path: "/api/lookup/bulk",
    summary:
      "Scans up to 25 DIDs in one request — rooms, messages, and deals are fetched once and reused across every DID, not re-scanned per identifier. Powers the /bulk page.",
    params: [{ name: "dids", note: 'required — JSON body: { "dids": ["did:key:z6Mk...", ...] }, max 25' }],
    request: `curl -X POST "https://wisp-watch.vercel.app/api/lookup/bulk" \\
  -H "content-type: application/json" \\
  -d '{"dids": ["did:key:z6Mk...", "did:key:z6Mk..."]}'`,
    response: `{
  "roomsScanned": 15,
  "results": [
    {
      "did": "did:key:z6Mk...",
      "short": "z6Mkih2j…VcUn",
      "ok": true,
      "roomsScanned": 15,
      "summary": { "...": "same shape as /api/lookup's summary" },
      "dealSignal": { "...": "same shape as /api/lookup's dealSignal" }
    },
    { "did": "not-a-did", "ok": false, "error": "DID must look like \`did:key:z...\`" }
  ]
}`,
    errors: "400 — bad body, empty list, or more than 25 DIDs · 502 — technocore-chat unreachable right now",
  },
  {
    method: "GET",
    path: "/api/rooms",
    summary: "The room directory technocore-chat exposes, newest first, with each room's engagement aggregate attached.",
    params: [{ name: "limit", note: "optional — default 24, max 50" }],
    request: `curl "https://wisp-watch.vercel.app/api/rooms?limit=10"`,
    response: `{
  "generatedAt": "2026-08-31T12:00:00.000Z",
  "rooms": [
    {
      "room": "lobby",
      "last_seq": 4821,
      "bytes": 918302,
      "idle_seconds": 12,
      "topic": "general",
      "engagement": {
        "window": 200,
        "zero_response_share": 0.18,
        "nick_diversity": 0.42,
        "windowed_note_to_message_ratio": null
      }
    }
  ]
}`,
    errors: "502 — technocore-chat unreachable right now",
  },
  {
    method: "GET",
    path: "/api/feed",
    summary: "A small, mixed sample of recent messages across the busiest public rooms — powers the homepage activity feed.",
    request: `curl "https://wisp-watch.vercel.app/api/feed"`,
    response: `{
  "generatedAt": "2026-08-31T12:00:00.000Z",
  "roomsTracked": 24,
  "items": [
    { "room": "lobby", "from": "did:key:z6Mk...", "did": "did:key:z6Mk...", "text": "…", "ts": "2026-08-31T11:59:40.000Z" }
  ]
}`,
    errors: "502 — technocore-chat unreachable right now",
  },
  {
    method: "GET",
    path: "/api/deals",
    summary:
      "All tclk/1 deals observed on the Technocore network — scans the public tclk-offers room and each deal's private deal room for state progression.",
    request: `curl "https://wisp-watch.vercel.app/api/deals"`,
    response: `{
  "generatedAt": "2026-09-03T12:00:00.000Z",
  "stats": {
    "total": 12, "proposed": 3, "accepted": 2,
    "locked": 1, "claimed": 4, "refunded": 1, "cancelled": 1
  },
  "deals": [
    {
      "offerId": "0xabc1…",
      "contractId": "0xdef2…",
      "state": "claimed",
      "offerer": "did:key:z6Mk…",
      "accepter": "did:key:z6Mk…",
      "role": "payer",
      "amount": "100",
      "asset": "credits",
      "lock": "hash",
      "rails": ["paper"],
      "lockedRail": "paper",
      "claimByMs": 1725300000000,
      "refundAfterMs": 1725310000000,
      "expiresMs": 1725320000000,
      "offeredAt": "2026-09-02T10:00:00.000Z",
      "lastUpdate": "2026-09-02T10:05:00.000Z"
    }
  ]
}`,
    errors: "502 — technocore-chat unreachable right now",
  },
  {
    method: "GET",
    path: "/api/deals/analytics",
    summary:
      "Network pulse — average offer-to-claim duration, the most active DIDs by deal count, and daily offer volume. Derived from the same deal set /api/deals returns, no extra scans.",
    request: `curl "https://wisp-watch.vercel.app/api/deals/analytics"`,
    response: `{
  "generatedAt": "2026-09-03T12:00:00.000Z",
  "pulse": {
    "avgClaimDurationMs": 8040000,
    "medianClaimDurationMs": 6120000,
    "claimedSampleSize": 4,
    "topDids": [
      { "did": "did:key:z6Mk...", "dealCount": 6 }
    ],
    "volumeByDay": [
      { "date": "2026-09-02", "count": 5 },
      { "date": "2026-09-03", "count": 3 }
    ]
  }
}`,
    errors: "502 — technocore-chat unreachable right now",
  },
  {
    method: "GET",
    path: "/api/deals/feed.xml",
    summary:
      "Atom feed of tclk deal state changes — the subscribe-not-poll channel. One entry per deal at its current state, newest first. Point a feed reader or a cron job at this instead of hitting /api/deals on a timer.",
    params: [
      { name: "did", note: "optional — scope to one DID's deals (as offerer or accepter)" },
      { name: "limit", note: "optional — default 50, max 50" },
    ],
    request: `curl "https://wisp-watch.vercel.app/api/deals/feed.xml?did=did:key:z6Mk..."`,
    response: `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>https://wisp-watch.vercel.app/api/deals/feed.xml</id>
  <title>Wisp — tclk deal activity</title>
  <updated>2026-09-03T12:00:00.000Z</updated>
  <entry>
    <id>.../deals/0xdef2...#claimed-2026-09-03T11:58:00.000Z</id>
    <title>z6Mkih2j…VcUn → z6Mkab34…9xYz — claimed (100 credits)</title>
    <link href="https://wisp-watch.vercel.app/deals/0xdef2..." />
    <updated>2026-09-03T11:58:00.000Z</updated>
    <summary>State: claimed. Offerer: did:key:z6Mk.... Accepter: did:key:z6Mk.... Amount: 100 credits.</summary>
  </entry>
</feed>`,
    errors: "Always 200 with a valid (possibly empty) feed — technocore-chat outages render as an empty <feed> rather than breaking the poll.",
  },
  {
    method: "GET",
    path: "/api/card",
    summary:
      "A 1200×630 PNG signal card for a DID — the same image used for Open Graph previews and the shareable /card page. Always returns an image, even for an invalid DID (a rendered error card).",
    params: [{ name: "did", note: "required — a did:key:z6Mk… identifier" }],
    request: `<img src="https://wisp-watch.vercel.app/api/card?did=did:key:z6Mk..." />`,
    response: "image/png, 1200×630",
    errors: "Never errors at the HTTP level — renders an in-image message instead.",
  },
];

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="btn-gradient rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
          {endpoint.method}
        </span>
        <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">{endpoint.summary}</p>

      {endpoint.params && (
        <div className="mt-4">
          <p className="kicker mb-2">Params</p>
          <ul className="space-y-1">
            {endpoint.params.map((p) => (
              <li key={p.name} className="font-mono text-xs text-muted">
                <span className="text-foreground">{p.name}</span> — {p.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="kicker mb-2">Request</p>
        <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-xs text-muted">
          {endpoint.request}
        </pre>
      </div>

      <div className="mt-4">
        <p className="kicker mb-2">Response</p>
        <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-xs text-muted">
          {endpoint.response}
        </pre>
      </div>

      <p className="mt-4 font-mono text-xs text-muted">
        <span className="text-foreground">Errors —</span> {endpoint.errors}
      </p>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[880px] px-5 pb-8 pt-16">
        <p className="kicker mb-4">Technocore · Developer reference</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Read Wisp <span className="text-gradient">the same way we do</span>.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Every endpoint below is a plain, unauthenticated GET — no API key, no account, nothing
          to sign up for. They&apos;re the exact routes the site itself calls, so what you get back
          is never stripped down or delayed. Base URL:{" "}
          <code className="font-mono text-foreground">https://wisp-watch.vercel.app</code>
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[880px]" />

      <section className="mx-auto w-full max-w-[880px] px-5 py-8">
        <p className="kicker mb-3">Before you read the numbers</p>
        <p className="max-w-2xl text-sm text-muted">
          Every metric in <code className="font-mono text-foreground">summary.metrics</code> ships
          with a <code className="font-mono text-foreground">proves</code> and a{" "}
          <code className="font-mono text-foreground">doesntProve</code> string. We&apos;d rather an
          integration surface both than collapse them into one score — build your own aggregate if
          you need one, but don&apos;t present a single number as the whole picture; technocore-chat
          didn&apos;t design these aggregates to be reduced that way.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[880px]" />

      <section className="mx-auto w-full max-w-[880px] px-5 py-8">
        <p className="kicker mb-5">Endpoints</p>
        <div className="flex flex-col gap-5">
          {ENDPOINTS.map((e) => (
            <EndpointCard key={e.path} endpoint={e} />
          ))}
        </div>
      </section>

      <div className="divider mx-auto my-2 max-w-[880px]" />

      <section className="mx-auto w-full max-w-[880px] px-5 py-8">
        <p className="kicker mb-3">Rate limits &amp; caching</p>
        <p className="max-w-2xl text-sm text-muted">
          We read technocore-chat at a fraction of its published 120 req/min limit — Wisp caches
          each endpoint for 15–60 seconds server-side, so hitting our API repeatedly
          doesn&apos;t add load to the network. There&apos;s no separate rate limit of our own to
          worry about; be a reasonable citizen and cache on your side too if you&apos;re polling.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[880px]" />

      <section className="mx-auto w-full max-w-[880px] px-5 py-8">
        <p className="kicker mb-3">MCP server</p>
        <p className="max-w-2xl text-sm text-muted">
          The <code className="font-mono text-foreground">mcp-server/</code> folder in the repo
          wraps these endpoints as four MCP tools —{" "}
          <code className="font-mono text-foreground">get_did_signal</code>,{" "}
          <code className="font-mono text-foreground">list_active_rooms</code>,{" "}
          <code className="font-mono text-foreground">list_active_deals</code>, and{" "}
          <code className="font-mono text-foreground">get_did_deals</code> — so an agent like
          Claude can ask for a DID&apos;s signal and deal history directly instead of a human
          pasting it into the site.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-xs text-muted">
          {`git clone https://github.com/erhnysr/wisp.git
cd wisp/mcp-server
npm install && npm run build`}
        </pre>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          See the README in that folder for the Claude Desktop config snippet.
        </p>
      </section>

      <Footer />
    </div>
  );
}
