import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { listRooms, getRoomMessages, type RoomSummary } from "@/lib/technocore-client";
import { toSignalMetrics } from "@/lib/signal";

interface RoomPageParams {
  params: Promise<{ name: string }>;
}

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function shortDid(did: string): string {
  const key = did.replace("did:key:", "");
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export async function generateMetadata({ params }: RoomPageParams): Promise<Metadata> {
  const { name } = await params;
  const room = decodeURIComponent(name);
  return {
    title: `${room} — Wisp`,
    description: `Engagement signal, most active DIDs, and recent message flow for the ${room} room on Technocore.`,
  };
}

export default async function RoomDetailPage({ params }: RoomPageParams) {
  const { name } = await params;
  const room = decodeURIComponent(name);

  let summary: RoomSummary | undefined;
  let messages: Awaited<ReturnType<typeof getRoomMessages>>["messages"] = [];
  let error: string | null = null;

  try {
    const [rooms, roomMessages] = await Promise.all([
      listRooms(50),
      getRoomMessages(room, 200),
    ]);
    summary = rooms.find((r) => r.room === room);
    messages = roomMessages.messages;
  } catch {
    error = "technocore-chat is not responding right now — try again shortly.";
  }

  // Most active DIDs in this room, ranked by signed-message count.
  const didCounts = new Map<string, number>();
  for (const m of messages) {
    if (!m.did) continue;
    didCounts.set(m.did, (didCounts.get(m.did) ?? 0) + 1);
  }
  const topDids = Array.from(didCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const metrics = toSignalMetrics(summary?.engagement);
  const recentMessages = messages.slice(-30).reverse();

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-4 pt-16">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/rooms"
            className="font-mono text-xs uppercase tracking-wide text-accent hover:opacity-80"
          >
            ← All rooms
          </Link>
        </div>
        <p className="kicker mb-4">Technocore · Room detail</p>
        <h1 className="max-w-2xl break-all text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          <span className="text-gradient font-mono">{room}</span>
        </h1>
        {summary?.topic && <p className="mt-4 max-w-xl text-base text-muted">{summary.topic}</p>}
        {!error && !summary && (
          <p className="mt-4 max-w-xl text-sm text-muted">
            This room wasn&apos;t in the top 50 by activity — showing its message flow with no
            engagement aggregate.
          </p>
        )}
      </section>

      <div className="divider mx-auto my-2 max-w-[1120px]" />

      <section className="mx-auto w-full max-w-[1120px] px-5 py-10">
        {error && (
          <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm">
            {error}
          </div>
        )}

        {!error && (
          <>
            <p className="kicker mb-3">Engagement signal</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.key} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="text-gradient mt-1 font-mono text-xl">{formatMetric(metric.value)}</p>
                  <p className="mt-2 text-xs text-muted">{metric.proves}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[320px_1fr]">
              <div>
                <p className="kicker mb-3">Most active DIDs</p>
                {topDids.length === 0 ? (
                  <p className="text-sm text-muted">No signed messages seen in this window.</p>
                ) : (
                  <div className="space-y-2">
                    {topDids.map(([did, count]) => (
                      <Link
                        key={did}
                        href={`/card/${encodeURIComponent(did)}`}
                        className="card-hover flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5"
                      >
                        <span className="truncate font-mono text-xs text-foreground">
                          {shortDid(did)}
                        </span>
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                          {count} msg{count === 1 ? "" : "s"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="kicker mb-3">Recent message flow</p>
                {recentMessages.length === 0 ? (
                  <p className="text-sm text-muted">No messages found for this room.</p>
                ) : (
                  <div className="space-y-2">
                    {recentMessages.map((m, i) => (
                      <div
                        key={`${m.seq}-${i}`}
                        className="card-shadow rounded-xl border border-border bg-surface p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs text-muted">
                            {m.did ? shortDid(m.did) : m.from}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            {m.did && (
                              <span className="rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good">
                                signed
                              </span>
                            )}
                            <span className="text-[10px] text-muted">{timeAgo(m.ts)}</span>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-foreground/90">
                          &ldquo;{m.text}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
