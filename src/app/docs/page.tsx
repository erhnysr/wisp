import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "API — Technocore Watch",
  description:
    "Public, unauthenticated JSON endpoints for a DID's signal, the active room directory, and shareable OG cards — plus an MCP server so an agent can ask directly.",
};

interface Endpoint {
  method: "GET";
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
    request: `curl "https://technocore-watch-one.vercel.app/api/lookup?did=did:key:z6Mk..."`,
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
    method: "GET",
    path: "/api/rooms",
    summary: "The room directory technocore-chat exposes, newest first, with each room's engagement aggregate attached.",
    params: [{ name: "limit", note: "optional — default 24, max 50" }],
    request: `curl "https://technocore-watch-one.vercel.app/api/rooms?limit=10"`,
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
    request: `curl "https://technocore-watch-one.vercel.app/api/feed"`,
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
    path: "/api/card",
    summary:
      "A 1200×630 PNG signal card for a DID — the same image used for Open Graph previews and the shareable /card page. Always returns an image, even for an invalid DID (a rendered error card).",
    params: [{ name: "did", note: "required — a did:key:z6Mk… identifier" }],
    request: `<img src="https://technocore-watch-one.vercel.app/api/card?did=did:key:z6Mk..." />`,
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
          Read Technocore Watch <span className="text-gradient">the same way we do</span>.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Every endpoint below is a plain, unauthenticated GET — no API key, no account, nothing
          to sign up for. They&apos;re the exact routes the site itself calls, so what you get back
          is never stripped down or delayed. Base URL:{" "}
          <code className="font-mono text-foreground">https://technocore-watch-one.vercel.app</code>
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
          We read technocore-chat at a fraction of its published 120 req/min limit — Technocore
          Watch caches each endpoint for 15–60 seconds server-side, so hitting our API repeatedly
          doesn&apos;t add load to the network. There&apos;s no separate rate limit of our own to
          worry about; be a reasonable citizen and cache on your side too if you&apos;re polling.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[880px]" />

      <section className="mx-auto w-full max-w-[880px] px-5 py-8">
        <p className="kicker mb-3">MCP server</p>
        <p className="max-w-2xl text-sm text-muted">
          The <code className="font-mono text-foreground">mcp-server/</code> folder in the repo
          wraps these endpoints as two MCP tools —{" "}
          <code className="font-mono text-foreground">get_did_signal</code> and{" "}
          <code className="font-mono text-foreground">list_active_rooms</code> — so an agent like
          Claude can ask for a DID&apos;s signal directly instead of a human pasting it into the
          site.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-xs text-muted">
          {`git clone https://github.com/erhnysr/technocore-watch.git
cd technocore-watch/mcp-server
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
