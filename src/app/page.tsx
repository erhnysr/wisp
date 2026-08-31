import { Navbar } from "@/components/Navbar";
import { StatTile } from "@/components/StatTile";
import { SignalLookup } from "@/components/SignalLookup";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProvesGrid } from "@/components/ProvesGrid";
import { SeedNotice } from "@/components/SeedNotice";
import { Footer } from "@/components/Footer";
import { WatcherMascot } from "@/components/WatcherMascot";
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
        {/* Decorative Stripe-style gradient mesh — a soft indigo field with a
            single warm coral accent tucked in the corner, purely visual. */}
        <div
          className="bg-blob -left-56 -top-56 h-[560px] w-[560px] opacity-[0.32]"
          style={{ background: "radial-gradient(circle, #7c6bff 0%, transparent 70%)" }}
        />
        <div
          className="bg-blob -right-44 -top-24 h-[420px] w-[420px] opacity-[0.28]"
          style={{ background: "radial-gradient(circle, #f2765c 0%, transparent 70%)" }}
        />
        <div
          className="bg-blob left-1/3 top-64 h-[340px] w-[340px] opacity-[0.16]"
          style={{ background: "radial-gradient(circle, #5b4fe0 0%, transparent 70%)" }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-[1120px] items-start justify-between gap-8 px-5 pb-4 pt-20">
          <div className="max-w-2xl">
            <span className="kicker-pill fade-in-up mb-5">
              <span className="kicker-dot" />
              <span className="kicker">Technocore · Independent Monitoring</span>
            </span>
            <h1 className="fade-in-up-delay-1 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Identities shouldn&apos;t just prove they{" "}
              <span className="text-gradient text-glow">exist</span>
              <br className="hidden sm:block" /> — they should prove they contribute.
            </h1>
            <p className="fade-in-up-delay-1 mt-4 max-w-xl text-base text-muted">
              Paste a public DID — we read its real activity on the Technocore network straight
              from technocore-chat&apos;s own engagement data. No setup, no account, no key ever
              asked.
            </p>

            <div className="fade-in-up-delay-2 mt-8 max-w-2xl">
              <SignalLookup />
            </div>

            <div className="fade-in-up-delay-2 mt-10 grid max-w-md grid-cols-2 gap-3">
              <StatTile value={roomsTracked} label="Rooms tracked" />
              <StatTile value="GET-only" label="technocore-chat API" />
            </div>
          </div>

          <WatcherMascot className="fade-in-up-delay-2 hidden w-[200px] shrink-0 lg:block xl:w-[240px]" />
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
