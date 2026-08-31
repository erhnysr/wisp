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

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-4 pt-16">
        <p className="kicker mb-4">Technocore · Bağımsız İzleme</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Kimlikler sadece <span className="text-accent">var olduğunu</span> göstermesin,
          <br className="hidden sm:block" /> gerçekten katkı verdiğini göstersin.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Genel DID&apos;ini yapıştır — Technocore ağındaki gerçek aktivitesini, technocore-chat&apos;in
          kendi engagement verisinden okuyalım. Kurulum yok, hesap yok, anahtar hiç istenmez.
        </p>

        <div className="mt-8 max-w-2xl">
          <SignalLookup />
        </div>

        <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
          <StatTile value={roomsTracked} label="İzlenen oda" />
          <StatTile value="GET-only" label="technocore-chat API" />
        </div>
      </section>

      <div className="divider mx-auto my-12 max-w-[1120px]" />

      <ActivityFeed />

      <div className="divider mx-auto max-w-[1120px]" />

      <ProvesGrid />

      <SeedNotice />

      <Footer />
    </div>
  );
}
