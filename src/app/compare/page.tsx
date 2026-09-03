import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CompareLookup } from "@/components/CompareLookup";

export const metadata: Metadata = {
  title: "Compare — Wisp",
  description:
    "Compare two Technocore DIDs side by side — engagement signal and tclk deal history, read straight from the network's own data.",
};

export default function ComparePage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-4 pt-16">
        <p className="kicker mb-4">Technocore · Side-by-side signal</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Which DID would you rather{" "}
          <span className="text-gradient">deal with</span>?
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Paste two DIDs to see their engagement signal and tclk deal history next to each
          other — the same honest, un-scored panel as a single lookup, just doubled.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[1120px]" />

      <section className="mx-auto w-full max-w-[1120px] px-5 py-10">
        <CompareLookup />
      </section>

      <Footer />
    </div>
  );
}
