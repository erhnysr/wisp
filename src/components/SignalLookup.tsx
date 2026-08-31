"use client";

import { useState } from "react";
import Link from "next/link";
import type { SignalSummary } from "@/lib/signal";

interface LookupResponse {
  did: string;
  short: string;
  roomsScanned: number;
  summary: SignalSummary;
}

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function CopyableDid({ did, short }: { did: string; short: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(did);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the full DID is still visible via the
      // title tooltip on hover.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Click to copy full DID: ${did}`}
      className="rounded px-1 -mx-1 font-mono text-lg text-foreground transition-colors hover:bg-accent-soft"
    >
      {copied ? "Copied ✓" : short}
    </button>
  );
}

export function SignalLookup() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: LookupResponse }
  >({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/lookup?did=${encodeURIComponent(input.trim())}`);
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="did:key:z6Mk…"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-3 font-mono text-sm text-foreground shadow-sm placeholder:text-muted/70 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="btn-gradient rounded-full px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state.status === "loading" ? "Scanning…" : "Show signal"}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        A public DID is all you need — no account, no key. Scans the ~15 most active rooms, see
        Limits below.
      </p>

      {state.status === "error" && (
        <div className="mt-6 rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm text-foreground/90">
          {state.message}
        </div>
      )}

      {state.status === "ready" && (
        <div className="card-shadow mt-6 rounded-2xl border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="kicker">Identity</p>
              <CopyableDid did={state.data.did} short={state.data.short} />
            </div>
            <div className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              seen in {state.data.summary.roomsSeenIn.length} room
              {state.data.summary.roomsSeenIn.length === 1 ? "" : "s"}
            </div>
          </div>

          {state.data.summary.roomsSeenIn.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No signed messages from this DID were found across the {state.data.roomsScanned}{" "}
              rooms scanned. That can mean it&apos;s active in a quiet/unlisted room, or hasn&apos;t
              posted yet — it isn&apos;t proof of absence.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {state.data.summary.metrics.map((metric) => (
                <div key={metric.key} className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="text-gradient mt-1 font-mono text-xl">{formatMetric(metric.value)}</p>
                  <p className="mt-2 text-xs text-muted">{metric.proves}</p>
                </div>
              ))}
            </div>
          )}

          <Link
            href={`/card/${encodeURIComponent(state.data.did)}`}
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
          >
            View shareable card →
          </Link>
        </div>
      )}
    </div>
  );
}
