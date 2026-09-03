"use client";

import { useState } from "react";
import Link from "next/link";
import type { SignalSummary, DealSignal } from "@/lib/signal";

interface LookupResponse {
  did: string;
  short: string;
  roomsScanned: number;
  summary: SignalSummary;
  dealSignal: DealSignal;
}

type SideState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LookupResponse };

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

async function fetchSide(did: string): Promise<SideState> {
  try {
    const res = await fetch(`/api/lookup?did=${encodeURIComponent(did)}`);
    const body = await res.json();
    if (!res.ok) return { status: "error", message: body.error ?? "Unknown error." };
    return { status: "ready", data: body };
  } catch {
    return { status: "error", message: "Couldn't reach the network — try again shortly." };
  }
}

/** Renders a metric value, bolding it when it beats the other side's value. */
function MetricCell({
  value,
  winner,
}: {
  value: number | null;
  winner: boolean;
}) {
  return (
    <span
      className={`font-mono text-sm ${winner ? "text-gradient font-bold" : "text-foreground/80"}`}
    >
      {formatMetric(value)}
    </span>
  );
}

function SideHeader({ label, data }: { label: string; data: LookupResponse }) {
  return (
    <div>
      <p className="kicker">{label}</p>
      <Link
        href={`/card/${encodeURIComponent(data.did)}`}
        title={data.did}
        className="font-mono text-base text-foreground hover:text-accent"
      >
        {data.short}
      </Link>
      <p className="mt-0.5 text-xs text-muted">
        seen in {data.summary.roomsSeenIn.length} room
        {data.summary.roomsSeenIn.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function CompareLookup() {
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [a, setA] = useState<SideState>({ status: "idle" });
  const [b, setB] = useState<SideState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputA.trim() || !inputB.trim()) return;
    setA({ status: "loading" });
    setB({ status: "loading" });
    const [resultA, resultB] = await Promise.all([
      fetchSide(inputA.trim()),
      fetchSide(inputB.trim()),
    ]);
    setA(resultA);
    setB(resultB);
  }

  const bothReady = a.status === "ready" && b.status === "ready";
  const loading = a.status === "loading" || b.status === "loading";

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <input
          value={inputA}
          onChange={(e) => setInputA(e.target.value)}
          placeholder="did:key:z6Mk… (A)"
          className="rounded-full border border-border bg-surface px-4 py-3 font-mono text-sm text-foreground shadow-sm placeholder:text-muted/70 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <span className="hidden items-center justify-center px-1 font-mono text-xs uppercase text-muted sm:flex">
          vs
        </span>
        <input
          value={inputB}
          onChange={(e) => setInputB(e.target.value)}
          placeholder="did:key:z6Mk… (B)"
          className="rounded-full border border-border bg-surface px-4 py-3 font-mono text-sm text-foreground shadow-sm placeholder:text-muted/70 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-gradient rounded-full px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Compare"}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Two public DIDs, side by side — same signal panel data as a single lookup, scanned in
        parallel.
      </p>

      {(a.status === "error" || b.status === "error") && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {a.status === "error" && (
            <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm text-foreground/90">
              A: {a.message}
            </div>
          )}
          {b.status === "error" && (
            <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm text-foreground/90">
              B: {b.message}
            </div>
          )}
        </div>
      )}

      {bothReady && (
        <div className="card-shadow mt-6 rounded-2xl border border-border bg-surface p-6">
          <div className="grid grid-cols-2 gap-4">
            <SideHeader label="A" data={a.data} />
            <SideHeader label="B" data={b.data} />
          </div>

          <div className="mt-6 space-y-2">
            <p className="kicker mb-2">Signal metrics</p>
            {a.data.summary.metrics.map((metricA, i) => {
              const metricB = b.data.summary.metrics[i];
              const higherIsA =
                metricA.value !== null &&
                (metricB?.value === null || metricB?.value === undefined
                  ? true
                  : metricA.value > metricB.value);
              const higherIsB =
                metricB?.value !== null &&
                metricB?.value !== undefined &&
                (metricA.value === null ? true : metricB.value > metricA.value);
              return (
                <div
                  key={metricA.key}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
                >
                  <div className="flex justify-start">
                    <MetricCell value={metricA.value} winner={higherIsA} />
                  </div>
                  <p className="text-center text-xs text-muted">{metricA.label}</p>
                  <div className="flex justify-end">
                    <MetricCell value={metricB?.value ?? null} winner={higherIsB} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="kicker mb-2">tclk deal activity</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <p className="font-mono text-sm text-foreground/80">
                {a.data.dealSignal.totalDeals} deals · {a.data.dealSignal.claimed} claimed ·{" "}
                {formatMetric(a.data.dealSignal.completionRate)} completion
              </p>
              <p className="text-center text-xs text-muted">deals</p>
              <p className="text-right font-mono text-sm text-foreground/80">
                {b.data.dealSignal.totalDeals} deals · {b.data.dealSignal.claimed} claimed ·{" "}
                {formatMetric(b.data.dealSignal.completionRate)} completion
              </p>
            </div>
            <p className="mt-3 text-xs text-muted">
              Higher completion means more locked deals reached &quot;claimed&quot; — doesn&apos;t
              prove real value changed hands, only that the protocol handshake finished.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
