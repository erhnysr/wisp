"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { DealDetailResponse } from "@/app/api/deals/[contractId]/route";
import type { DealState, DealEvent, TclkFrameType } from "@/lib/tclk";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortDid(did: string): string {
  if (!did.startsWith("did:key:z6Mk")) return did.slice(0, 16) + "…";
  const key = did.slice(8);
  return key.slice(0, 8) + "…" + key.slice(-4);
}

const STATE_CONFIG: Record<
  DealState,
  { label: string; bg: string; text: string; dot: string }
> = {
  proposed: { label: "Proposed", bg: "bg-accent-soft", text: "text-accent", dot: "bg-accent" },
  accepted: { label: "Accepted", bg: "bg-[rgba(124,107,255,0.1)]", text: "text-accent-2", dot: "bg-accent-2" },
  locked: { label: "Locked", bg: "bg-[rgba(242,118,92,0.1)]", text: "text-accent-warm", dot: "bg-accent-warm" },
  claimed: { label: "Claimed", bg: "bg-good/10", text: "text-good", dot: "bg-good" },
  refunded: { label: "Refunded", bg: "bg-warning-soft", text: "text-warning", dot: "bg-warning" },
  cancelled: { label: "Cancelled", bg: "bg-[rgba(107,112,137,0.1)]", text: "text-muted", dot: "bg-muted" },
};

const FRAME_CONFIG: Record<
  TclkFrameType,
  { label: string; icon: string; color: string }
> = {
  offer: { label: "Offer posted", icon: "📤", color: "text-accent" },
  accept: { label: "Deal accepted", icon: "🤝", color: "text-accent-2" },
  lock: { label: "Funds locked", icon: "🔒", color: "text-accent-warm" },
  reveal: { label: "Secret revealed", icon: "🔑", color: "text-good" },
  refund: { label: "Refund requested", icon: "↩", color: "text-warning" },
  cancel: { label: "Cancelled", icon: "✕", color: "text-muted" },
  receipt: { label: "Receipt posted", icon: "📋", color: "text-muted" },
};

/** The expected deal state progression for the progress bar. */
const STATE_STEPS: DealState[] = ["proposed", "accepted", "locked", "claimed"];

function ProgressBar({ state }: { state: DealState }) {
  const isTerminal = state === "refunded" || state === "cancelled";
  const activeIdx = isTerminal
    ? STATE_STEPS.indexOf("locked") // refund/cancel stop at or before locked
    : STATE_STEPS.indexOf(state);

  return (
    <div className="flex items-center gap-1">
      {STATE_STEPS.map((step, i) => {
        const reached = i <= activeIdx;
        const isCurrent = i === activeIdx;
        const cfg = STATE_CONFIG[step];
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                reached
                  ? isTerminal && isCurrent
                    ? "bg-warning"
                    : `${cfg.dot}`
                  : "bg-border"
              }`}
            />
            <span
              className={`font-mono text-[9px] uppercase tracking-wide ${
                reached ? "text-foreground" : "text-muted/50"
              }`}
            >
              {step}
            </span>
          </div>
        );
      })}
      {isTerminal && (
        <div className="flex flex-col items-center gap-1.5 pl-1">
          <div className={`h-1.5 w-8 rounded-full ${STATE_CONFIG[state].dot}`} />
          <span className={`font-mono text-[9px] uppercase tracking-wide ${STATE_CONFIG[state].text}`}>
            {state}
          </span>
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event, isLast }: { event: DealEvent; isLast: boolean }) {
  const cfg = FRAME_CONFIG[event.type];
  const stateCfg = event.resultState ? STATE_CONFIG[event.resultState] : null;

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm">
          {cfg.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>

      {/* Content */}
      <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          {stateCfg && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${stateCfg.bg} ${stateCfg.text}`}
            >
              <span className={`h-1 w-1 rounded-full ${stateCfg.dot}`} />
              {stateCfg.label}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          <code className="font-mono">{shortDid(event.from)}</code>
          <span>·</span>
          <span title={event.ts}>{formatDate(event.ts)}</span>
          <span className="text-muted/50">({timeAgo(event.ts)})</span>
        </div>
        {event.detail && Object.keys(event.detail).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(event.detail).map(
              ([key, val]) =>
                val !== undefined && (
                  <span
                    key={key}
                    className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {key}: {typeof val === "object" ? JSON.stringify(val) : String(val)}
                  </span>
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${label}`}
      className="tap-shrink rounded px-1 -mx-1 font-mono text-xs text-foreground/80 transition-colors hover:bg-accent-soft hover:text-accent"
    >
      {copied ? "Copied ✓" : text}
    </button>
  );
}

export function DealTimeline({ id }: { id: string }) {
  const { data, isLoading } = useSWR<DealDetailResponse>(
    `/api/deals/${encodeURIComponent(id)}`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-5 py-10">
        <div className="card-shadow animate-pulse rounded-2xl border border-border bg-surface p-8">
          <div className="h-4 w-1/3 rounded bg-border" />
          <div className="mt-6 h-3 w-2/3 rounded bg-border" />
          <div className="mt-4 h-3 w-1/2 rounded bg-border" />
          <div className="mt-8 h-24 rounded bg-border" />
        </div>
      </div>
    );
  }

  if (!data?.deal) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-5 py-10">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-medium text-foreground">
            {data?.error ?? "Deal not found"}
          </p>
          <p className="mt-2 text-sm text-muted">
            This deal may not exist yet, or technocore-chat isn&apos;t returning
            it right now.
          </p>
          <Link
            href="/deals"
            className="mt-4 inline-block font-mono text-xs uppercase tracking-wide text-accent hover:opacity-80"
          >
            ← Back to all deals
          </Link>
        </div>
      </div>
    );
  }

  const deal = data.deal;
  const payer = deal.role === "payer" ? deal.offerer : deal.accepter;
  const payee = deal.role === "payee" ? deal.offerer : deal.accepter;

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-10">
      {/* Header card */}
      <div className="card-shadow rounded-2xl border border-border bg-surface p-6 sm:p-8">
        {/* State + progress */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker mb-2">Deal state</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${STATE_CONFIG[deal.state].bg} ${STATE_CONFIG[deal.state].text}`}
            >
              <span className={`h-2 w-2 rounded-full ${STATE_CONFIG[deal.state].dot}`} />
              {STATE_CONFIG[deal.state].label}
            </span>
          </div>
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <ProgressBar state={deal.state} />
          </div>
        </div>

        {/* Amount */}
        <div className="mt-6">
          <p className="kicker mb-1">Amount</p>
          <div className="flex items-baseline gap-2">
            <span className="text-gradient font-mono text-3xl font-bold">{deal.amount}</span>
            <span className="font-mono text-sm uppercase text-muted">{deal.asset}</span>
          </div>
        </div>

        {/* IDs */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="kicker mb-1">Offer ID</p>
            <CopyButton text={deal.offerId} label="offer ID" />
          </div>
          {deal.contractId && (
            <div>
              <p className="kicker mb-1">Contract ID</p>
              <CopyButton text={deal.contractId} label="contract ID" />
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {payer && (
            <div>
              <p className="kicker mb-1">Payer</p>
              <Link
                href={`/card/${encodeURIComponent(payer)}`}
                className="font-mono text-xs text-accent hover:opacity-80"
                title={payer}
              >
                {shortDid(payer)}
              </Link>
            </div>
          )}
          {payee && (
            <div>
              <p className="kicker mb-1">Payee</p>
              <Link
                href={`/card/${encodeURIComponent(payee)}`}
                className="font-mono text-xs text-accent hover:opacity-80"
                title={payee}
              >
                {shortDid(payee)}
              </Link>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase text-muted">
            lock: {deal.lock}
          </span>
          {deal.rails.map((rail) => (
            <span
              key={rail}
              className={`rounded border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase ${
                deal.lockedRail === rail
                  ? "border-accent/30 text-accent"
                  : "text-muted"
              }`}
            >
              rail: {rail}{deal.lockedRail === rail ? " ✓" : ""}
            </span>
          ))}
        </div>

        {/* Timing */}
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-[10px] uppercase text-muted">Claim by</p>
            <p className="font-mono text-xs text-foreground">
              {deal.claimByMs ? formatDate(new Date(deal.claimByMs).toISOString()) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-[10px] uppercase text-muted">Refund after</p>
            <p className="font-mono text-xs text-foreground">
              {deal.refundAfterMs ? formatDate(new Date(deal.refundAfterMs).toISOString()) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-[10px] uppercase text-muted">Expires</p>
            <p className="font-mono text-xs text-foreground">
              {deal.expiresMs ? formatDate(new Date(deal.expiresMs).toISOString()) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <p className="kicker mb-5">Frame timeline</p>
        <div className="card-shadow rounded-2xl border border-border bg-surface p-6">
          {deal.events.length === 0 ? (
            <p className="text-sm text-muted">No events recorded yet.</p>
          ) : (
            <div className="flex flex-col">
              {deal.events.map((event, i) => (
                <TimelineEvent
                  key={`${event.type}-${event.ts}`}
                  event={event}
                  isLast={i === deal.events.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* What this proves */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card-shadow rounded-xl border border-border bg-surface p-5">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-good">
            Proves
          </h3>
          <p className="mt-2 text-sm text-foreground/85">
            That these DIDs posted signed tclk/1 frames following the protocol&apos;s
            state machine — every transition shown above is a verifiable message
            in a public room.
          </p>
        </div>
        <div className="card-shadow rounded-xl border border-border bg-surface p-5">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-accent-warm">
            Doesn&apos;t prove
          </h3>
          <p className="mt-2 text-sm text-foreground/85">
            That real value changed hands. PaperRail settles nothing — these are
            protocol rehearsals. Both sides could also be the same entity
            operating two DIDs.
          </p>
        </div>
      </div>
    </div>
  );
}
