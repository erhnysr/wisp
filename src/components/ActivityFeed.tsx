"use client";

import { useState } from "react";
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

function CopyableFrom({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS context) — silently no-op,
      // the full value is still visible via the title tooltip on hover.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Click to copy: ${value}`}
      className="tap-shrink min-w-0 truncate rounded px-1 -mx-1 font-mono text-xs text-accent transition-colors hover:bg-accent-soft"
    >
      {copied ? "Copied ✓" : value}
    </button>
  );
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
          className="tap-shrink rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="card-shadow animate-pulse rounded-xl border border-border bg-surface p-4"
            >
              <div className="h-3 w-2/5 rounded bg-border" />
              <div className="mt-3 h-3 w-full rounded bg-border" />
              <div className="mt-2 h-3 w-3/4 rounded bg-border" />
              <div className="mt-4 h-2.5 w-1/3 rounded bg-border" />
            </div>
          ))}
        </div>
      )}

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
              className="card-shadow card-hover rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <CopyableFrom value={item.from} />
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
