import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseDid } from "@/lib/did";
import { scanDidActivity } from "@/lib/lookup";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CardActions } from "@/components/CardActions";

interface CardPageParams {
  params: Promise<{ did: string }>;
}

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

async function loadCard(encodedDid: string) {
  const did = decodeURIComponent(encodedDid);
  const parsed = parseDid(did);
  if (!parsed.ok) return null;

  try {
    const { roomsScanned, summary } = await scanDidActivity(parsed.value.did);
    return { did: parsed.value.did, short: parsed.value.short, roomsScanned, summary };
  } catch {
    return { did: parsed.value.did, short: parsed.value.short, roomsScanned: 0, summary: null };
  }
}

export async function generateMetadata({ params }: CardPageParams): Promise<Metadata> {
  const { did } = await params;
  const parsed = parseDid(decodeURIComponent(did));
  const title = parsed.ok
    ? `${parsed.value.short} — Technocore Watch`
    : "Technocore Watch — signal card";
  const imageUrl = `/api/card?did=${encodeURIComponent(decodeURIComponent(did))}`;

  return {
    title,
    description: "A public, honest signal card — reads technocore-chat's own engagement data. No key ever asked.",
    openGraph: {
      title,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [imageUrl],
    },
  };
}

export default async function CardPage({ params }: CardPageParams) {
  const { did: encodedDid } = await params;
  const card = await loadCard(encodedDid);

  if (!card) notFound();

  const { did, short, roomsScanned, summary } = card;
  const cardImageUrl = `/api/card?did=${encodeURIComponent(did)}`;

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      <section className="mx-auto w-full max-w-[720px] px-5 py-16">
        <Link href="/" className="font-mono text-xs uppercase tracking-wide text-muted hover:text-foreground">
          ← Back to Technocore_Watch
        </Link>

        <div className="card-shadow mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardImageUrl} alt={`Signal card for ${short}`} className="w-full" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="kicker">Identity</p>
            <p className="font-mono text-sm text-foreground">{short}</p>
          </div>
          <CardActions did={did} imageUrl={cardImageUrl} />
        </div>

        {summary && summary.roomsSeenIn.length > 0 && (
          <div className="mt-8">
            <p className="kicker mb-3">Rooms this identity was seen in</p>
            <div className="flex flex-wrap gap-2">
              {summary.roomsSeenIn.map((r) => (
                <span
                  key={r.room}
                  className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted"
                >
                  {r.room} · {r.didMessageCount} msg
                </span>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {summary.metrics.map((m) => (
              <div key={m.key} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted">{m.label}</p>
                <p className="text-gradient mt-1 font-mono text-xl">{formatMetric(m.value)}</p>
                <p className="mt-2 text-xs text-muted">{m.doesntProve}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs text-muted">
          Scanned the {roomsScanned} most active public rooms. This is a public lookup, not proof
          of ownership — see the Proves / Doesn&apos;t Prove section on the homepage.
        </p>
      </section>

      <Footer />
    </div>
  );
}
