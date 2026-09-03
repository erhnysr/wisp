"use client";

import { useState } from "react";
import Link from "next/link";
import type { BulkLookupResponse, BulkLookupResult } from "@/app/api/lookup/bulk/route";

// Mirrors BULK_MAX_DIDS in src/lib/lookup.ts (server-only module, not
// imported here to keep this client bundle free of network/lib code).
const BULK_MAX_DIDS_CLIENT = 25;

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function parseInput(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: BulkLookupResponse };

export function BulkLookup() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  const dids = parseInput(input);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dids.length === 0) return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/lookup/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dids }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.error ?? "Unknown error." });
        return;
      }
      setState({ status: "ready", data: body });
    } catch {
      setState({ status: "error", message: "Couldn't reach the network — try again shortly." });
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"did:key:z6Mk…\ndid:key:z6Mk…\ndid:key:z6Mk…"}
          rows={5}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 font-mono text-sm text-foreground shadow-sm placeholder:text-muted/70 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            One DID per line (or comma-separated) · {dids.length} / {BULK_MAX_DIDS_CLIENT}
          </p>
          <button
            type="submit"
            disabled={state.status === "loading" || dids.length === 0 || dids.length > BULK_MAX_DIDS_CLIENT}
            className="btn-gradient rounded-full px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state.status === "loading" ? "Scanning…" : `Scan ${dids.length || ""}`.trim()}
          </button>
        </div>
      </form>

      {state.status === "error" && (
        <div className="mt-6 rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm text-foreground/90">
          {state.message}
        </div>
      )}

      {state.status === "ready" && (
        <div className="card-shadow mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="kicker px-4 py-3 font-normal">DID</th>
                <th className="kicker px-4 py-3 font-normal">Rooms seen</th>
                <th className="kicker px-4 py-3 font-normal">Unanswered</th>
                <th className="kicker px-4 py-3 font-normal">Nick diversity</th>
                <th className="kicker px-4 py-3 font-normal">Deals</th>
                <th className="kicker px-4 py-3 font-normal">Completion</th>
              </tr>
            </thead>
            <tbody>
              {state.data.results.map((r) => (
                <BulkRow key={r.did} result={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BulkRow({ result }: { result: BulkLookupResult }) {
  if (!result.ok) {
    return (
      <tr className="border-b border-border/60 last:border-0">
        <td className="px-4 py-3 font-mono text-xs text-foreground/80" colSpan={6}>
          <span className="text-warning">{result.did.slice(0, 40)}</span>
          <span className="ml-2 text-muted">— {result.error}</span>
        </td>
      </tr>
    );
  }

  const unanswered = result.summary.metrics.find((m) => m.key === "zero_response_share")?.value ?? null;
  const nickDiversity = result.summary.metrics.find((m) => m.key === "nick_diversity")?.value ?? null;

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-accent-soft/40">
      <td className="px-4 py-3">
        <Link href={`/card/${encodeURIComponent(result.did)}`} className="font-mono text-xs text-foreground hover:text-accent">
          {result.short}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80">{result.summary.roomsSeenIn.length}</td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80">{formatMetric(unanswered)}</td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80">{formatMetric(nickDiversity)}</td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80">{result.dealSignal.totalDeals}</td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80">
        {formatMetric(result.dealSignal.completionRate)}
      </td>
    </tr>
  );
}
