"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DealsResponse } from "@/app/api/deals/route";
import type { Deal, DealState } from "@/lib/tclk";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function shortDid(did: string): string {
  if (!did.startsWith("did:key:z6Mk")) return did.slice(0, 16) + "…";
  const key = did.slice(8); // after "did:key:"
  return key.slice(0, 8) + "…" + key.slice(-4);
}

const STATE_CONFIG: Record<
  DealState,
  { label: string; bg: string; text: string; dot: string }
> = {
  proposed: {
    label: "Proposed",
    bg: "bg-accent-soft",
    text: "text-accent",
    dot: "bg-accent",
  },
  accepted: {
    label: "Accepted",
    bg: "bg-[rgba(124,107,255,0.1)]",
    text: "text-accent-2",
    dot: "bg-accent-2",
  },
  locked: {
    label: "Locked",
    bg: "bg-[rgba(242,118,92,0.1)]",
    text: "text-accent-warm",
    dot: "bg-accent-warm",
  },
  claimed: {
    label: "Claimed",
    bg: "bg-good/10",
    text: "text-good",
    dot: "bg-good",
  },
  refunded: {
    label: "Refunded",
    bg: "bg-warning-soft",
    text: "text-warning",
    dot: "bg-warning",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-[rgba(107,112,137,0.1)]",
    text: "text-muted",
    dot: "bg-muted",
  },
};

function StateBadge({ state }: { state: DealState }) {
  const cfg = STATE_CONFIG[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const payer = deal.role === "payer" ? deal.offerer : deal.accepter;
  const payee = deal.role === "payee" ? deal.offerer : deal.accepter;

  return (
    <div className="card-shadow card-hover rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="truncate font-mono text-xs text-foreground">
              {deal.offerId.slice(0, 18)}…
            </code>
            <StateBadge state={deal.state} />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-gradient font-mono text-xl font-bold">
              {deal.amount}
            </span>
            <span className="font-mono text-xs uppercase text-muted">
              {deal.asset}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
          {deal.lock}
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        {payer && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-12 shrink-0 font-mono uppercase text-muted">
              payer
            </span>
            <code className="truncate font-mono text-foreground/80">
              {shortDid(payer)}
            </code>
          </div>
        )}
        {payee && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-12 shrink-0 font-mono uppercase text-muted">
              payee
            </span>
            <code className="truncate font-mono text-foreground/80">
              {shortDid(payee)}
            </code>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {deal.rails.map((rail) => (
            <span
              key={rail}
              className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted"
            >
              {rail}
            </span>
          ))}
        </div>
        <p className="kicker">{timeAgo(deal.lastUpdate)}</p>
      </div>
    </div>
  );
}

type FilterState = "all" | DealState;

export function DealsFeed() {
  const { data, isLoading, mutate } = useSWR<DealsResponse>(
    "/api/deals",
    fetcher,
    { refreshInterval: 60_000 },
  );
  const [filter, setFilter] = useState<FilterState>("all");

  const deals = data?.deals ?? [];
  const stats = data?.stats;
  const filtered =
    filter === "all" ? deals : deals.filter((d) => d.state === filter);

  const filterOptions: { key: FilterState; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats?.total },
    { key: "locked", label: "Locked", count: stats?.locked },
    { key: "accepted", label: "Accepted", count: stats?.accepted },
    { key: "proposed", label: "Proposed", count: stats?.proposed },
    { key: "claimed", label: "Claimed", count: stats?.claimed },
    { key: "refunded", label: "Refunded", count: stats?.refunded },
    { key: "cancelled", label: "Cancelled", count: stats?.cancelled },
  ];

  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="kicker mb-2">tclk/1 · Technocore Lock Protocol</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {stats
              ? `${stats.total} deal${stats.total === 1 ? "" : "s"} observed`
              : "Loading deals…"}
          </h2>
        </div>
        <button
          onClick={() => mutate()}
          className="tap-shrink self-start rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-foreground sm:self-auto"
        >
          Refresh
        </button>
      </div>

      {/* Stats row */}
      {stats && stats.total > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(["proposed", "accepted", "locked", "claimed", "refunded", "cancelled"] as const).map(
            (state) => (
              <div
                key={state}
                className="card-shadow rounded-xl border border-border bg-surface px-3 py-3 text-center"
              >
                <div className="text-gradient font-mono text-lg font-bold">
                  {stats[state]}
                </div>
                <div className="kicker mt-0.5">{state}</div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Filter pills */}
      {stats && stats.total > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {filterOptions.map(
            (opt) =>
              (opt.count ?? 0) > 0 && (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`tap-shrink rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                    filter === opt.key
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-border bg-surface text-muted hover:border-accent/30 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                  {opt.count != null && (
                    <span className="ml-1.5 opacity-60">{opt.count}</span>
                  )}
                </button>
              ),
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="card-shadow animate-pulse rounded-xl border border-border bg-surface p-5"
            >
              <div className="h-3 w-2/5 rounded bg-border" />
              <div className="mt-4 h-5 w-1/3 rounded bg-border" />
              <div className="mt-4 h-3 w-3/4 rounded bg-border" />
              <div className="mt-2 h-3 w-2/3 rounded bg-border" />
              <div className="mt-4 h-2.5 w-1/4 rounded bg-border" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {data?.error && (
        <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm">
          {data.error}
        </div>
      )}

      {/* Empty state */}
      {data && !data.error && deals.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-medium text-foreground">No deals yet</p>
          <p className="mt-2 text-sm text-muted">
            The tclk-offers room hasn&apos;t seen any deal activity, or
            technocore-chat is not returning it right now.
          </p>
        </div>
      )}

      {/* Deal cards */}
      {filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deal) => (
            <DealCard key={deal.offerId} deal={deal} />
          ))}
        </div>
      )}

      {/* Filtered empty */}
      {data && !data.error && deals.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No deals in the &ldquo;{filter}&rdquo; state.
        </div>
      )}
    </section>
  );
}
