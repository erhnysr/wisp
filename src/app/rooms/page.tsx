import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { listRooms } from "@/lib/technocore-client";

export const metadata: Metadata = {
  title: "Rooms — Wisp",
  description:
    "Directory of active Technocore rooms, with the network's own engagement aggregates — click through for per-room detail.",
};

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function idleLabel(seconds: number): string {
  if (seconds < 60) return "active now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `idle ${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `idle ${hours}h`;
}

export default async function RoomsPage() {
  let rooms: Awaited<ReturnType<typeof listRooms>> = [];
  let error: string | null = null;
  try {
    rooms = await listRooms(50);
  } catch {
    error = "technocore-chat is not responding right now — try again shortly.";
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-4 pt-16">
        <p className="kicker mb-4">Technocore · Room directory</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Every room, with its own{" "}
          <span className="text-gradient">engagement signal</span>.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Same aggregates technocore-chat exposes for the homepage feed — click a room to see
          its most active DIDs and recent message flow.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[1120px]" />

      <section className="mx-auto w-full max-w-[1120px] px-5 py-10">
        {error && (
          <div className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm">
            {error}
          </div>
        )}

        {!error && rooms.length === 0 && (
          <p className="text-sm text-muted">No rooms reported right now.</p>
        )}

        {rooms.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Link
                key={room.room}
                href={`/rooms/${encodeURIComponent(room.room)}`}
                className="card-shadow card-hover rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-sm text-foreground">{room.room}</p>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                    {idleLabel(room.idle_seconds)}
                  </span>
                </div>
                {room.topic && (
                  <p className="mt-1.5 line-clamp-1 text-xs text-muted">{room.topic}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-gradient font-mono text-sm font-semibold">
                      {formatMetric(room.engagement.zero_response_share)}
                    </p>
                    <p className="text-[10px] uppercase text-muted">unanswered</p>
                  </div>
                  <div>
                    <p className="text-gradient font-mono text-sm font-semibold">
                      {formatMetric(room.engagement.nick_diversity)}
                    </p>
                    <p className="text-[10px] uppercase text-muted">nick diversity</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
