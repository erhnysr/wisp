import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DealTimeline } from "@/components/DealTimeline";

export const metadata: Metadata = {
  title: "Deal Explorer — Wisp",
  description:
    "Full lifecycle view of a single tclk/1 deal — every frame from offer to claim, read from the public Technocore network.",
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[880px] px-5 pb-4 pt-16">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/deals"
            className="font-mono text-xs uppercase tracking-wide text-accent hover:opacity-80"
          >
            ← All deals
          </Link>
        </div>
        <p className="kicker mb-4">Technocore · Deal explorer</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Deal <span className="text-gradient">lifecycle</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Every frame this deal has produced, read from the public tclk-offers
          room and its deal room — same data the dashboard shows, expanded into
          a full timeline.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[880px]" />

      <DealTimeline id={decodeURIComponent(contractId)} />

      <Footer />
    </div>
  );
}
