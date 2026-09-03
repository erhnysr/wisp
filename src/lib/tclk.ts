/**
 * tclk/1 (Technocore Lock Protocol) — frame parser, types, and state machine.
 *
 * Wisp reads tclk deal activity the same way it reads engagement data: from
 * the public room messages technocore-chat already exposes. No key material
 * is ever needed — we're observers, not participants.
 *
 * Reference: https://github.com/flop-labs/tclk (SPEC.md)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TclkFrameType =
  | "offer"
  | "accept"
  | "lock"
  | "reveal"
  | "refund"
  | "cancel"
  | "receipt";

export type DealState =
  | "proposed"
  | "accepted"
  | "locked"
  | "claimed"
  | "refunded"
  | "cancelled";

export const TERMINAL_STATES: ReadonlySet<DealState> = new Set([
  "claimed",
  "refunded",
  "cancelled",
]);

export interface TclkOffer {
  type: "offer";
  id: string;
  from: string;
  role: "payer" | "payee";
  amount: string;
  asset: string;
  lock: "hash" | "point";
  rails: string[];
  claimByMs: number;
  refundAfterMs: number;
  expiresMs: number;
  nonce: string;
  paymentKey?: string;
  job?: { proto: string; id: string; context?: string };
}

export interface TclkAccept {
  type: "accept";
  from: string;
  ref: string; // offer id
  statement: string;
  contract: string;
  nonce: string;
  paymentKey?: string;
}

export interface TclkLock {
  type: "lock";
  from: string;
  contract: string;
  rail: string;
  ref: string;
}

export interface TclkReveal {
  type: "reveal";
  from: string;
  contract: string;
  secret: string;
}

export interface TclkRefund {
  type: "refund";
  from: string;
  contract: string;
  reason?: string;
}

export interface TclkCancel {
  type: "cancel";
  from: string;
  contract: string;
  reason?: string;
}

export interface TclkReceipt {
  type: "receipt";
  from: string;
  contract: string;
  outcome: "claimed" | "refunded" | "cancelled";
  rail?: string;
  ref?: string;
}

export type TclkFrame =
  | TclkOffer
  | TclkAccept
  | TclkLock
  | TclkReveal
  | TclkRefund
  | TclkCancel
  | TclkReceipt;

/** A deal as Wisp tracks it — aggregated from room messages. */
export interface Deal {
  /** The offer's id (sha256-based). */
  offerId: string;
  /** Contract id — set once accept arrives. */
  contractId: string | null;
  state: DealState;
  offerer: string;
  /** The counterparty who accepted. */
  accepter: string | null;
  role: "payer" | "payee";
  amount: string;
  asset: string;
  lock: "hash" | "point";
  rails: string[];
  /** Rail chosen in the lock frame. */
  lockedRail: string | null;
  claimByMs: number;
  refundAfterMs: number;
  expiresMs: number;
  /** Timestamp of the offer message. */
  offeredAt: string;
  /** Timestamp of the most recent state transition. */
  lastUpdate: string;
}

// ---------------------------------------------------------------------------
// Frame parsing
// ---------------------------------------------------------------------------

const TCLK_PREFIX = "tclk1 ";

/**
 * Try to decode a tclk/1 frame from a raw message line.
 * Returns null for non-tclk lines or malformed frames — fail-closed,
 * matching the spec's "decode or reject" rule.
 */
export function decodeFrame(line: string): TclkFrame | null {
  if (!line.startsWith(TCLK_PREFIX)) return null;
  const jsonStr = line.slice(TCLK_PREFIX.length);

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;

  const type = obj.type;
  if (typeof type !== "string") return null;

  // We only need to identify the type and extract fields we display.
  // We're an observer, not a participant — we don't need to validate
  // cryptographic correctness of hashes/signatures.
  switch (type) {
    case "offer":
      if (
        typeof obj.id !== "string" ||
        typeof obj.from !== "string" ||
        typeof obj.amount !== "string" ||
        typeof obj.asset !== "string"
      )
        return null;
      return {
        type: "offer",
        id: obj.id as string,
        from: obj.from as string,
        role: (obj.role as "payer" | "payee") ?? "payer",
        amount: obj.amount as string,
        asset: obj.asset as string,
        lock: (obj.lock as "hash" | "point") ?? "hash",
        rails: Array.isArray(obj.rails) ? (obj.rails as string[]) : [],
        claimByMs: Number(obj.claimByMs) || 0,
        refundAfterMs: Number(obj.refundAfterMs) || 0,
        expiresMs: Number(obj.expiresMs) || 0,
        nonce: String(obj.nonce ?? ""),
        paymentKey: obj.paymentKey as string | undefined,
        job: obj.job as TclkOffer["job"],
      };

    case "accept":
      if (typeof obj.from !== "string" || typeof obj.ref !== "string") return null;
      return {
        type: "accept",
        from: obj.from as string,
        ref: obj.ref as string,
        statement: String(obj.statement ?? ""),
        contract: String(obj.contract ?? ""),
        nonce: String(obj.nonce ?? ""),
        paymentKey: obj.paymentKey as string | undefined,
      };

    case "lock":
      if (typeof obj.from !== "string" || typeof obj.contract !== "string") return null;
      return {
        type: "lock",
        from: obj.from as string,
        contract: obj.contract as string,
        rail: String(obj.rail ?? ""),
        ref: String(obj.ref ?? ""),
      };

    case "reveal":
      if (typeof obj.from !== "string" || typeof obj.contract !== "string") return null;
      return {
        type: "reveal",
        from: obj.from as string,
        contract: obj.contract as string,
        secret: String(obj.secret ?? ""),
      };

    case "refund":
      if (typeof obj.from !== "string" || typeof obj.contract !== "string") return null;
      return {
        type: "refund",
        from: obj.from as string,
        contract: obj.contract as string,
        reason: obj.reason as string | undefined,
      };

    case "cancel":
      if (typeof obj.from !== "string" || typeof obj.contract !== "string") return null;
      return {
        type: "cancel",
        from: obj.from as string,
        contract: obj.contract as string,
        reason: obj.reason as string | undefined,
      };

    case "receipt":
      if (typeof obj.from !== "string" || typeof obj.contract !== "string") return null;
      return {
        type: "receipt",
        from: obj.from as string,
        contract: obj.contract as string,
        outcome: obj.outcome as "claimed" | "refunded" | "cancelled",
        rail: obj.rail as string | undefined,
        ref: obj.ref as string | undefined,
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// State machine (observer-mode: we fold frames to track deal state)
// ---------------------------------------------------------------------------

/**
 * Valid state transitions for tclk/1.
 * We don't enforce who-sends-what (we're observers), but we do enforce
 * the state progression so our dashboard shows accurate states.
 */
const TRANSITIONS: Record<string, Partial<Record<TclkFrameType, DealState>>> = {
  proposed: { accept: "accepted", cancel: "cancelled" },
  accepted: { lock: "locked", cancel: "cancelled" },
  locked: { reveal: "claimed", refund: "refunded" },
};

export function advanceDealState(
  current: DealState,
  frameType: TclkFrameType,
): DealState | null {
  if (frameType === "receipt") return null; // receipt doesn't change state
  const transitions = TRANSITIONS[current];
  if (!transitions) return null;
  return transitions[frameType] ?? null;
}

// ---------------------------------------------------------------------------
// Deal event timeline — frame-level history for the deal explorer
// ---------------------------------------------------------------------------

/** A single observed frame event in a deal's lifecycle. */
export interface DealEvent {
  type: TclkFrameType;
  from: string;
  ts: string;
  /** State the deal moved to after this frame (null for receipts). */
  resultState: DealState | null;
  /** Extra data depending on frame type. */
  detail?: Record<string, unknown>;
}

/** A deal with its full frame history for the explorer page. */
export interface DealDetail extends Deal {
  events: DealEvent[];
}

// ---------------------------------------------------------------------------
// Deal aggregation from room messages
// ---------------------------------------------------------------------------

export interface DealStats {
  total: number;
  proposed: number;
  accepted: number;
  locked: number;
  claimed: number;
  refunded: number;
  cancelled: number;
}

export function computeDealStats(deals: Deal[]): DealStats {
  const stats: DealStats = {
    total: deals.length,
    proposed: 0,
    accepted: 0,
    locked: 0,
    claimed: 0,
    refunded: 0,
    cancelled: 0,
  };
  for (const d of deals) {
    stats[d.state]++;
  }
  return stats;
}
