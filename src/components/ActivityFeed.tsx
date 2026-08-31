"use client";

import useSWR from "swr";
import type { FeedResponse } from "@/app/api/feed/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function ActivityFeed() {
  const { data, isLoading, mutate } = useSWR<FeedResponse>("/api/feed", fetcher, {
    refreshInterval: 60_000,
  });

  return (
    <section className="mx-auto max-w-[1120px] px-5 py-14">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="kicker mb-2">Seen recently on the network</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {data && !data.error ? `${data.roomsTracked} rooms tracked` : "Loading room count…"}
          </h2>
        </div>
        <button
          onClick={() => mutate()}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {isLoading && <div className="text-sm text-muted">Loading…</div>}

      {data?.error && (
        <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm">
          {data.error}
        </div>
      )}

      {data?.items && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item, i) => (
            <div
              key={`${item.room}-${item.ts}-${i}`}
              className="card-shadow rounded-xl border border-border bg-surface p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-accent">{item.from}</span>
                {item.did && (
                  <span className="shrink-0 rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good">
                    signed
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-foreground/90">&ldquo;{item.text}&rdquo;</p>
              <p className="kicker mt-3">
                {item.room} · {timeAgo(item.ts)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
