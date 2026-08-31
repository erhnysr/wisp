"use client";

import { useState } from "react";
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
        setState({ status: "error", message: body.error ?? "Bilinmeyen hata." });
        return;
      }
      setState({ status: "ready", data: body });
    } catch {
      setState({ status: "error", message: "Ağa ulaşılamadı, birazdan tekrar dene." });
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="did:key:z6Mk…"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state.status === "loading" ? "Taranıyor…" : "Sinyali göster"}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Genel DID yeter, hesap veya anahtar gerekmez. En aktif ~15 oda taranır — bkz. aşağıdaki sınırlar.
      </p>

      {state.status === "error" && (
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-foreground/90">
          {state.message}
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="kicker">Kimlik</p>
              <p className="font-mono text-lg">{state.data.short}</p>
            </div>
            <div className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              {state.data.summary.roomsSeenIn.length} odada görüldü
            </div>
          </div>

          {state.data.summary.roomsSeenIn.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Taranan {state.data.roomsScanned} aktif odada bu DID&apos;e ait imzalı mesaj bulunamadı. Bu,
              kimliğin sessiz/unlisted bir odada olduğu ya da henüz mesaj atmadığı anlamına gelebilir —
              yokluk kanıtı değildir.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {state.data.summary.metrics.map((metric) => (
                <div key={metric.key} className="rounded-xl border border-border bg-surface-raised p-4">
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="mt-1 font-mono text-xl text-accent">{formatMetric(metric.value)}</p>
                  <p className="mt-2 text-xs text-muted">{metric.proves}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
