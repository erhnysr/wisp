"use client";

import Link from "next/link";
import useSWR from "swr";
import type { AnalyticsResponse } from "@/app/api/deals/analytics/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function shortDid(did: string): string {
  const key = did.replace("did:key:", "");
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Simple CSS bar chart — no charting dependency, matches the site's lean footprint. */
function VolumeChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No offers observed in the current window yet.</p>;
  }

  const recent = data.slice(-14);
  const max = Math.max(...recent.map((d) => d.count), 1);

  return (
    <div className="flex h-32 items-end gap-1.5">
      {recent.map((bucket) => (
        <div key={bucket.date} className="group relative flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-t-sm bg-gradient-to-t from-accent to-accent-2 transition-opacity group-hover:opacity-80"
            style={{ height: `${Math.max((bucket.count / max) * 100, 4)}%` }}
            title={`${bucket.date}: ${bucket.count} offer${bucket.count === 1 ? "" : "s"}`}
          />
          <span className="text-[9px] uppercase text-muted">{formatDayLabel(bucket.date)}</span>
        </div>
      ))}
    </div>
  );
}

export function NetworkPulse() {
  const { data, isLoading } = useSWR<AnalyticsResponse>("/api/deals/analytics", fetcher, {
    refreshInterval: 60_000,
  });

  const pulse = data?.pulse;

  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 pt-10">
      <p className="kicker mb-2">Network pulse</p>
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        The shape of the network, not just its list.
      </h2>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-shadow animate-pulse rounded-2xl border border-border bg-surface p-6">
              <div className="h-3 w-1/3 rounded bg-border" />
              <div className="mt-4 h-8 w-1/2 rounded bg-border" />
            </div>
          ))}
        </div>
      )}

      {data?.error && (
        <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm">{data.error}</div>
      )}

      {pulse && !data?.error && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card-shadow rounded-2xl border border-border bg-surface p-6">
            <p className="kicker mb-2">Avg. offer → claim</p>
            <p className="text-gradient font-mono text-3xl font-bold">
              {formatDuration(pulse.avgClaimDurationMs)}
            </p>
            <p className="mt-2 text-xs text-muted">
              {pulse.claimedSampleSize > 0
                ? `Across ${pulse.claimedSampleSize} claimed deal${pulse.claimedSampleSize === 1 ? "" : "s"} · median ${formatDuration(pulse.medianClaimDurationMs)}`
                : "No claimed deals observed yet."}
            </p>
          </div>

          <div className="card-shadow rounded-2xl border border-border bg-surface p-6">
            <p className="kicker mb-3">Most active DIDs</p>
            {pulse.topDids.length === 0 ? (
              <p className="text-sm text-muted">No deal activity observed yet.</p>
            ) : (
              <div className="space-y-1.5">
                {pulse.topDids.slice(0, 5).map((entry) => (
                  <Link
                    key={entry.did}
                    href={`/card/${encodeURIComponent(entry.did)}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-accent-soft"
                  >
                    <span className="truncate font-mono text-xs text-foreground">{shortDid(entry.did)}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{entry.dealCount}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card-shadow rounded-2xl border border-border bg-surface p-6">
            <p className="kicker mb-3">Offer volume, last 14 days</p>
            <VolumeChart data={pulse.volumeByDay} />
          </div>
        </div>
      )}
    </section>
  );
}
