import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BulkLookup } from "@/components/BulkLookup";

export const metadata: Metadata = {
  title: "Bulk Lookup — Wisp",
  description:
    "Scan up to 25 Technocore DIDs at once — signal metrics and tclk deal history side by side in one table.",
};

export default function BulkPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-4 pt-16">
        <p className="kicker mb-4">Technocore · Bulk signal scan</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Scan a whole{" "}
          <span className="text-gradient">list of DIDs</span> at once.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Paste up to 25 DIDs and get the same signal and deal data as a single lookup, in one
          table — rooms and deals are scanned once and reused across every identifier, not
          re-fetched per DID.
        </p>
      </section>

      <div className="divider mx-auto my-2 max-w-[1120px]" />

      <section className="mx-auto w-full max-w-[1120px] px-5 py-10">
        <BulkLookup />
      </section>

      <Footer />
    </div>
  );
}
