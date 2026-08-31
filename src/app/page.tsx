import { Navbar } from "@/components/Navbar";
import { StatTile } from "@/components/StatTile";
import { SignalLookup } from "@/components/SignalLookup";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProvesGrid } from "@/components/ProvesGrid";
import { SeedNotice } from "@/components/SeedNotice";
import { Footer } from "@/components/Footer";
import { listRooms } from "@/lib/technocore-client";

export default async function Home() {
  let roomsTracked = "—";
  try {
    const rooms = await listRooms(24);
    roomsTracked = String(rooms.length);
  } catch {
    // technocore-chat unreachable at build/request time — the client-side
    // feed below will retry and surface its own error state.
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="relative overflow-hidden">
        {/* Decorative "lively" background — blurred blue/purple blobs, purely visual */}
        <div
          className="bg-blob -left-48 -top-48 h-[540px] w-[540px] opacity-[0.55]"
          style={{ background: "radial-gradient(circle, #6d5ef7 0%, transparent 70%)" }}
        />
        <div
          className="bg-blob -right-40 top-0 h-[500px] w-[500px] opacity-[0.5]"
          style={{ background: "radial-gradient(circle, #4f7cff 0%, transparent 70%)" }}
        />
        <div
          className="bg-blob left-1/3 top-56 h-[420px] w-[420px] opacity-[0.32]"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
        />

        <div className="relative z-10 mx-auto w-full max-w-[1120px] px-5 pb-4 pt-20">
          <p className="kicker mb-4">Technocore · Independent Monitoring</p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Identities shouldn&apos;t just prove they <span className="text-gradient">exist</span>
            <br className="hidden sm:block" /> — they should prove they contribute.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted">
            Paste a public DID — we read its real activity on the Technocore network straight from
            technocore-chat&apos;s own engagement data. No setup, no account, no key ever asked.
          </p>

          <div className="mt-8 max-w-2xl">
            <SignalLookup />
          </div>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            <StatTile value={roomsTracked} label="Rooms tracked" />
            <StatTile value="GET-only" label="technocore-chat API" />
          </div>
        </div>
      </section>

      <div className="divider mx-auto my-4 max-w-[1120px]" />

      <ActivityFeed />

      <div className="divider mx-auto max-w-[1120px]" />

      <ProvesGrid />

      <SeedNotice />

      <Footer />
    </div>
  );
}
