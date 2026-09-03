/**
 * tclk deal scanner — reads the public `tclk-offers` room and derives
 * deal states from the message history.
 *
 * Same philosophy as the rest of Wisp: unauthenticated GETs against
 * technocore-chat's public API, generous caching, no keys.
 */

import { getRoomMessages, type RoomMessage } from "./technocore-client";
import { decodeFrame, advanceDealState, type Deal, type DealDetail, type DealEvent, type TclkOffer, type TclkAccept } from "./tclk";

/** The public room where tclk offers and accepts are posted. */
const OFFERS_ROOM = "tclk-offers";

/** How many messages to fetch from the offers room (covers recent history). */
const OFFERS_LIMIT = 500;

/**
 * Scans the `tclk-offers` room and reconstructs deal states.
 *
 * This is the tclk equivalent of `scanDidActivity` — it reads what's
 * publicly visible and makes it browsable. Deal rooms (`mb-p-tclk-*`)
 * are checked for lock/reveal/refund progression when we find accepted deals.
 */
export async function scanDeals(): Promise<Deal[]> {
  let messages: RoomMessage[];
  try {
    const result = await getRoomMessages(OFFERS_ROOM, OFFERS_LIMIT);
    messages = result.messages;
  } catch {
    // tclk-offers room might not exist yet or technocore-chat is down
    return [];
  }

  // Phase 1: Extract offers and accepts from the offers room
  const offersById = new Map<string, { offer: TclkOffer; ts: string }>();
  const acceptsByRef = new Map<string, { accept: TclkAccept; ts: string }>();

  for (const msg of messages) {
    const frame = decodeFrame(msg.text);
    if (!frame) continue;

    if (frame.type === "offer") {
      offersById.set(frame.id, { offer: frame, ts: msg.ts });
    } else if (frame.type === "accept") {
      acceptsByRef.set(frame.ref, { accept: frame, ts: msg.ts });
    }
  }

  // Phase 2: Build deal objects and check deal rooms for progression
  const deals: Deal[] = [];
  const dealRoomChecks: Promise<void>[] = [];

  for (const [offerId, { offer, ts }] of offersById) {
    const acceptEntry = acceptsByRef.get(offerId);

    const deal: Deal = {
      offerId,
      contractId: acceptEntry?.accept.contract ?? null,
      state: acceptEntry ? "accepted" : "proposed",
      offerer: offer.from,
      accepter: acceptEntry?.accept.from ?? null,
      role: offer.role,
      amount: offer.amount,
      asset: offer.asset,
      lock: offer.lock,
      rails: offer.rails,
      lockedRail: null,
      claimByMs: offer.claimByMs,
      refundAfterMs: offer.refundAfterMs,
      expiresMs: offer.expiresMs,
      offeredAt: ts,
      lastUpdate: acceptEntry?.ts ?? ts,
    };

    // If there's a contract, check the deal room for further progression
    if (deal.contractId) {
      const contractId = deal.contractId;
      dealRoomChecks.push(
        checkDealRoom(contractId, deal).catch(() => {
          // Deal room doesn't exist or is unreachable — deal stays at "accepted"
        }),
      );
    }

    deals.push(deal);
  }

  // Check up to 20 deal rooms in parallel (be a polite citizen)
  await Promise.allSettled(dealRoomChecks);

  // Sort: active deals first (by state priority), then by timestamp
  const statePriority: Record<string, number> = {
    locked: 0,
    accepted: 1,
    proposed: 2,
    claimed: 3,
    refunded: 4,
    cancelled: 5,
  };

  deals.sort((a, b) => {
    const pa = statePriority[a.state] ?? 99;
    const pb = statePriority[b.state] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
  });

  return deals;
}

/**
 * Reads the deal room (`mb-p-tclk-<first 16 hex of contract id>`) to
 * advance the deal's state past "accepted".
 */
async function checkDealRoom(contractId: string, deal: Deal): Promise<void> {
  // Contract id format: "0x" + 64 hex chars. Deal room uses first 16 hex after "0x".
  const hex = contractId.startsWith("0x") ? contractId.slice(2) : contractId;
  const roomName = `mb-p-tclk-${hex.slice(0, 16)}`;

  let messages: RoomMessage[];
  try {
    const result = await getRoomMessages(roomName, 100);
    messages = result.messages;
  } catch {
    return; // Room doesn't exist yet or unreachable
  }

  for (const msg of messages) {
    const frame = decodeFrame(msg.text);
    if (!frame) continue;

    // Only process frames that reference our contract
    if ("contract" in frame && frame.contract !== contractId) continue;

    const newState = advanceDealState(deal.state, frame.type);
    if (newState) {
      deal.state = newState;
      deal.lastUpdate = msg.ts;

      if (frame.type === "lock" && "rail" in frame) {
        deal.lockedRail = frame.rail;
      }
    }
  }
}

/**
 * Scans deals and filters to a specific DID's involvement.
 */
export async function scanDealsByDid(did: string): Promise<Deal[]> {
  const allDeals = await scanDeals();
  return allDeals.filter(
    (d) => d.offerer === did || d.accepter === did,
  );
}

/**
 * Returns a single deal with its full frame history (timeline) for
 * the deal explorer page. Searches by contractId or offerId.
 */
export async function scanDealDetail(id: string): Promise<DealDetail | null> {
  let messages: RoomMessage[];
  try {
    const result = await getRoomMessages(OFFERS_ROOM, OFFERS_LIMIT);
    messages = result.messages;
  } catch {
    return null;
  }

  // Find the offer and accept
  const offersById = new Map<string, { offer: TclkOffer; ts: string }>();
  const acceptsByRef = new Map<string, { accept: TclkAccept; ts: string }>();

  for (const msg of messages) {
    const frame = decodeFrame(msg.text);
    if (!frame) continue;
    if (frame.type === "offer") {
      offersById.set(frame.id, { offer: frame, ts: msg.ts });
    } else if (frame.type === "accept") {
      acceptsByRef.set(frame.ref, { accept: frame, ts: msg.ts });
    }
  }

  // Match by contractId or offerId
  let matchedOfferId: string | null = null;

  // Check offerId match first
  if (offersById.has(id)) {
    matchedOfferId = id;
  } else {
    // Search by contractId
    for (const [offerId, _offerEntry] of offersById) {
      const acceptEntry = acceptsByRef.get(offerId);
      if (acceptEntry?.accept.contract === id) {
        matchedOfferId = offerId;
        break;
      }
    }
  }

  if (!matchedOfferId) return null;

  const offerEntry = offersById.get(matchedOfferId)!;
  const acceptEntry = acceptsByRef.get(matchedOfferId);

  const events: DealEvent[] = [];

  // Offer event
  events.push({
    type: "offer",
    from: offerEntry.offer.from,
    ts: offerEntry.ts,
    resultState: "proposed",
    detail: {
      role: offerEntry.offer.role,
      amount: offerEntry.offer.amount,
      asset: offerEntry.offer.asset,
      lock: offerEntry.offer.lock,
      rails: offerEntry.offer.rails,
    },
  });

  const deal: DealDetail = {
    offerId: matchedOfferId,
    contractId: acceptEntry?.accept.contract ?? null,
    state: "proposed",
    offerer: offerEntry.offer.from,
    accepter: null,
    role: offerEntry.offer.role,
    amount: offerEntry.offer.amount,
    asset: offerEntry.offer.asset,
    lock: offerEntry.offer.lock,
    rails: offerEntry.offer.rails,
    lockedRail: null,
    claimByMs: offerEntry.offer.claimByMs,
    refundAfterMs: offerEntry.offer.refundAfterMs,
    expiresMs: offerEntry.offer.expiresMs,
    offeredAt: offerEntry.ts,
    lastUpdate: offerEntry.ts,
    events,
  };

  if (acceptEntry) {
    deal.state = "accepted";
    deal.accepter = acceptEntry.accept.from;
    deal.lastUpdate = acceptEntry.ts;
    events.push({
      type: "accept",
      from: acceptEntry.accept.from,
      ts: acceptEntry.ts,
      resultState: "accepted",
      detail: {
        statement: acceptEntry.accept.statement || undefined,
      },
    });
  }

  // Check deal room for further frames
  if (deal.contractId) {
    const hex = deal.contractId.startsWith("0x") ? deal.contractId.slice(2) : deal.contractId;
    const roomName = `mb-p-tclk-${hex.slice(0, 16)}`;

    try {
      const result = await getRoomMessages(roomName, 100);
      for (const msg of result.messages) {
        const frame = decodeFrame(msg.text);
        if (!frame) continue;
        if ("contract" in frame && frame.contract !== deal.contractId) continue;

        const newState = advanceDealState(deal.state, frame.type);

        const event: DealEvent = {
          type: frame.type,
          from: frame.from,
          ts: msg.ts,
          resultState: newState,
        };

        // Add type-specific details
        if (frame.type === "lock") {
          event.detail = { rail: frame.rail };
          if (newState) deal.lockedRail = frame.rail;
        } else if (frame.type === "refund" && frame.reason) {
          event.detail = { reason: frame.reason };
        } else if (frame.type === "cancel" && frame.reason) {
          event.detail = { reason: frame.reason };
        } else if (frame.type === "receipt") {
          event.detail = { outcome: frame.outcome, rail: frame.rail };
        }

        if (newState) {
          deal.state = newState;
          deal.lastUpdate = msg.ts;
        }

        events.push(event);
      }
    } catch {
      // Deal room unreachable — show what we have
    }
  }

  return deal;
}
