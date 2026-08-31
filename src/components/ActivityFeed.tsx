"use client";

import useSWR from "swr";
import type { FeedResponse } from "@/app/api/feed/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  return `${hours} sa önce`;
}

export function ActivityFeed() {
  const { data, isLoading, mutate } = useSWR<FeedResponse>("/api/feed", fetcher, {
    refreshInterval: 60_000,
  });

  return (
    <section className="mx-auto max-w-[1120px] px-5 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="kicker mb-2">Ağda az önce olanlar</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {data && !data.error
              ? `${data.roomsTracked} oda izleniyor`
              : "Ağdaki güncel oda sayısı yükleniyor…"}
          </h2>
        </div>
        <button
          onClick={() => mutate()}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-foreground"
        >
          Yenile
        </button>
      </div>

      {isLoading && <div className="text-sm text-muted">Yükleniyor…</div>}

      {data?.error && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">{data.error}</div>
      )}

      {data?.items && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item, i) => (
            <div key={`${item.room}-${item.ts}-${i}`} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-accent">{item.from}</span>
                {item.did && (
                  <span className="rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good">
                    imzalı
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
