#!/usr/bin/env node
/**
 * MCP server for Wisp.
 *
 * Two halves:
 * 1. READ tools — thin wrappers around Wisp's public JSON endpoints
 *    (no key material, no auth, plain GETs).
 * 2. DEAL tools — real tclk/1 participation: build frames with the
 *    official @flop-labs/tclk library and post them as signed messages
 *    to technocore-chat. Requires TECHNOCORE_SIGNING_KEY (32-byte hex
 *    Ed25519 seed) to be set.
 *
 * The server never persists keys, secrets, or preimages beyond the
 * process's own environment — same principle as the official tclk-mcp.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  makeOffer, makeAccept, generateHashLock, encodeFrame,
  openContract, applyFrame,
  OFFER_ROOM, dealRoom,
} from "@flop-labs/tclk";
import type { OfferFrame, TclkFrame } from "@flop-labs/tclk";
import { loadSigningIdentity, postSigned } from "./technocore-writer.js";

const BASE_URL = (process.env.TECHNOCORE_WATCH_BASE_URL ?? "https://wisp-watch.vercel.app").replace(
  /\/$/,
  "",
);

async function fetchJson(path: string): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { accept: "application/json" } });
    const body = await res.json();
    if (!res.ok) {
      const message = typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown network error" };
  }
}

const identity = loadSigningIdentity();

const server = new McpServer({
  name: "wisp",
  version: "0.2.0",
});

server.registerTool(
  "get_did_signal",
  {
    title: "Get a DID's signal",
    description:
      "Scans the most active public Technocore rooms for a did:key identifier and returns its engagement signal — rooms it was seen in, message counts, and technocore-chat's own windowed engagement metrics, each with an explicit 'proves' / 'doesn't prove' note. This is NOT a single trust score and does not prove DID ownership.",
    inputSchema: {
      did: z.string().describe("A did:key:z6Mk… identifier (Ed25519 only)."),
    },
  },
  async ({ did }) => {
    const result = await fetchJson(`/api/lookup?did=${encodeURIComponent(did)}`);
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(result.body, null, 2) }] };
  },
);

server.registerTool(
  "list_active_rooms",
  {
    title: "List active Technocore rooms",
    description:
      "Returns the public Technocore room directory, newest-active first, with each room's engagement aggregate (zero_response_share, nick_diversity, windowed_note_to_message_ratio) attached.",
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max rooms to return (default 24, max 50)."),
    },
  },
  async ({ limit }) => {
    const query = limit ? `?limit=${limit}` : "";
    const result = await fetchJson(`/api/rooms${query}`);
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(result.body, null, 2) }] };
  },
);

server.registerTool(
  "list_active_deals",
  {
    title: "List active tclk deals",
    description:
      "Returns all tclk/1 deals observed on the Technocore network — offers, accepts, locks, claims, refunds — with per-deal state, participants, amounts, and timing. Read from the public tclk-offers room.",
    inputSchema: {},
  },
  async () => {
    const result = await fetchJson("/api/deals");
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(result.body, null, 2) }] };
  },
);

server.registerTool(
  "get_did_deals",
  {
    title: "Get a DID's tclk deal history",
    description:
      "Returns all tclk/1 deals a specific DID has participated in — as offerer or accepter — with deal state, amount, rails, and timing.",
    inputSchema: {
      did: z.string().describe("A did:key:z6Mk… identifier (Ed25519 only)."),
    },
  },
  async ({ did }) => {
    const result = await fetchJson(`/api/lookup?did=${encodeURIComponent(did)}`);
    if (!result.ok) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
    }
    // Extract the dealSignal portion from the lookup response
    const body = result.body as Record<string, unknown>;
    const dealSignal = body.dealSignal ?? { totalDeals: 0, deals: [] };
    return { content: [{ type: "text", text: JSON.stringify({ did, dealSignal }, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// DEAL-MAKING TOOLS — real tclk/1 participation
// ---------------------------------------------------------------------------

function requireIdentity() {
  if (!identity) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: TECHNOCORE_SIGNING_KEY not set. Set it to a 32-byte hex Ed25519 seed to enable deal-making tools.",
        },
      ],
      isError: true,
    };
  }
  return null;
}

server.registerTool(
  "whoami",
  {
    title: "Who am I on Technocore",
    description:
      "Reports the DID this MCP server will sign frames as (derived from TECHNOCORE_SIGNING_KEY). Returns null if no signing key is configured — read-only tools still work.",
    inputSchema: {},
  },
  async () => {
    if (!identity) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ configured: false, message: "No TECHNOCORE_SIGNING_KEY set — read-only mode." }, null, 2),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ configured: true, did: identity.did }, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "create_offer",
  {
    title: "Create and post a tclk offer",
    description:
      "Builds a tclk/1 offer frame and posts it to the tclk-offers room as a signed message. Returns the offer ID and frame. The offer announces that you want to trade — specify your role (payer or payee), the amount, asset, accepted rails, and deadlines.",
    inputSchema: {
      role: z.enum(["payer", "payee"]).describe("Which side you take in the deal."),
      amount: z.string().describe("Amount in rail-native minimal units (decimal string)."),
      asset: z.string().describe("Asset identifier (e.g. 'FLOP', 'credits')."),
      rails: z.array(z.string()).describe("Settlement rails you accept (e.g. ['paper'])."),
      lock: z.enum(["hash", "point"]).optional().describe("Lock kind — default 'hash'."),
      claimWindowMinutes: z.number().optional().describe("How long the payee has to claim (default 60 minutes)."),
      refundGapMinutes: z.number().optional().describe("Gap between claim deadline and refund (default 60 minutes)."),
      expiresMinutes: z.number().optional().describe("How long the offer stays open (default 10 minutes)."),
      jobProto: z.string().optional().describe("Job protocol (e.g. 'a2a', 'acp')."),
      jobId: z.string().optional().describe("Job ID to bind this deal to."),
      jobContext: z.string().optional().describe("Job context string."),
    },
  },
  async ({ role, amount, asset, rails, lock, claimWindowMinutes, refundGapMinutes, expiresMinutes, jobProto, jobId, jobContext }) => {
    const err = requireIdentity();
    if (err) return err;

    const now = Date.now();
    const claimByMs = now + (claimWindowMinutes ?? 60) * 60_000;
    const refundAfterMs = claimByMs + (refundGapMinutes ?? 60) * 60_000;
    const expiresMs = now + (expiresMinutes ?? 10) * 60_000;

    const offer = makeOffer({
      from: identity!.did,
      role,
      amount,
      asset,
      lock: lock ?? "hash",
      rails,
      claimByMs,
      refundAfterMs,
      expiresMs,
      job: jobProto && jobId ? { proto: jobProto, id: jobId, context: jobContext } : undefined,
    });

    const frameLine = encodeFrame(offer);
    const postResult = await postSigned(identity!, OFFER_ROOM, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting offer: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              posted: true,
              room: OFFER_ROOM,
              seq: postResult.seq,
              offerId: offer.id,
              offer,
              instruction: "Wait for an accept frame referencing this offer ID. Once accepted, use lock_deal to escrow funds.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "accept_offer",
  {
    title: "Accept a tclk offer",
    description:
      "Accepts an existing offer by building an accept frame with a fresh hash lock. Posts the accept to the tclk-offers room. Returns the contract ID and the secret preimage — THE SECRET IS YOURS TO KEEP, it is never stored by this server. Reveal it only to claim the funds.",
    inputSchema: {
      offerId: z.string().describe("The offer ID to accept."),
      offerFrom: z.string().describe("The DID that posted the offer."),
      offerRole: z.enum(["payer", "payee"]).describe("The role of the offerer."),
      amount: z.string().describe("The offer's amount."),
      asset: z.string().describe("The offer's asset."),
      rails: z.array(z.string()).describe("The offer's rails."),
      lock: z.enum(["hash", "point"]).optional().describe("Lock kind from the offer (default 'hash')."),
      claimByMs: z.number().describe("The offer's claimByMs."),
      refundAfterMs: z.number().describe("The offer's refundAfterMs."),
      expiresMs: z.number().describe("The offer's expiresMs."),
      nonce: z.string().describe("The offer's nonce."),
    },
  },
  async ({ offerId, offerFrom, offerRole, amount, asset, rails, lock, claimByMs, refundAfterMs, expiresMs, nonce }) => {
    const err = requireIdentity();
    if (err) return err;

    // Reconstruct the offer frame for makeAccept
    const offer: OfferFrame = {
      type: "offer",
      id: offerId,
      from: offerFrom,
      role: offerRole,
      amount,
      asset,
      lock: lock ?? "hash",
      rails,
      claimByMs,
      refundAfterMs,
      expiresMs,
      nonce,
    };

    // Mint the hash lock
    const { preimage, hash } = generateHashLock();

    const accept = makeAccept(offer, {
      from: identity!.did,
      statement: hash,
    });

    const frameLine = encodeFrame(accept);
    const postResult = await postSigned(identity!, OFFER_ROOM, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting accept: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              posted: true,
              room: OFFER_ROOM,
              seq: postResult.seq,
              contractId: accept.contract,
              dealRoom: dealRoom(accept.contract),
              accept,
              secret: preimage,
              warning: "SAVE THE SECRET — it is not stored anywhere. You need it to claim the funds via reveal_secret. DO NOT share it until claiming.",
              instruction: "The offerer should now lock funds using lock_deal. Once locked, you claim by calling reveal_secret with your preimage.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "lock_deal",
  {
    title: "Lock funds on a rail",
    description:
      "Posts a lock frame to the deal room, announcing that funds are escrowed on the named rail. The payer calls this after the deal is accepted. Note: with PaperRail, no actual funds move — it's a protocol rehearsal.",
    inputSchema: {
      contractId: z.string().describe("The contract ID from the accept frame."),
      rail: z.string().describe("Which rail holds the funds (must be one the offer listed, e.g. 'paper')."),
      ref: z.string().optional().describe("Rail-specific reference (escrow id, txid). Default: contract ID."),
    },
  },
  async ({ contractId, rail, ref }) => {
    const err = requireIdentity();
    if (err) return err;

    const frame: TclkFrame = {
      type: "lock",
      from: identity!.did,
      contract: contractId,
      rail,
      ref: ref ?? contractId,
    };

    const frameLine = encodeFrame(frame);
    const room = dealRoom(contractId);
    const postResult = await postSigned(identity!, room, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting lock: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              posted: true,
              room,
              seq: postResult.seq,
              frame,
              instruction: "Deal is now locked. The payee should reveal their secret to claim, or you can refund after refundAfterMs.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "reveal_secret",
  {
    title: "Reveal secret to claim a deal",
    description:
      "Posts a reveal frame to the deal room, publishing the preimage/secret that claims the locked funds. Only the party who minted the lock (the accepter) should call this.",
    inputSchema: {
      contractId: z.string().describe("The contract ID."),
      secret: z.string().describe("The 0x-prefixed hex preimage from accept_offer."),
    },
  },
  async ({ contractId, secret }) => {
    const err = requireIdentity();
    if (err) return err;

    const frame: TclkFrame = {
      type: "reveal",
      from: identity!.did,
      contract: contractId,
      secret,
    };

    const frameLine = encodeFrame(frame);
    const room = dealRoom(contractId);
    const postResult = await postSigned(identity!, room, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting reveal: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              posted: true,
              room,
              seq: postResult.seq,
              frame,
              instruction: "Secret revealed — deal is claimed. The settlement rail processes the claim using this secret.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "refund_deal",
  {
    title: "Refund a locked deal",
    description:
      "Posts a refund frame to the deal room. The payer calls this after refundAfterMs to reclaim escrowed funds.",
    inputSchema: {
      contractId: z.string().describe("The contract ID."),
      reason: z.string().optional().describe("Optional reason for the refund."),
    },
  },
  async ({ contractId, reason }) => {
    const err = requireIdentity();
    if (err) return err;

    const frame: TclkFrame = {
      type: "refund",
      from: identity!.did,
      contract: contractId,
      reason,
    };

    const frameLine = encodeFrame(frame);
    const room = dealRoom(contractId);
    const postResult = await postSigned(identity!, room, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting refund: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ posted: true, room, seq: postResult.seq, frame }, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "cancel_deal",
  {
    title: "Cancel a deal before lock",
    description:
      "Posts a cancel frame. Either party can cancel before a lock exists (proposed or accepted state only).",
    inputSchema: {
      contractId: z.string().describe("The contract ID (or offer ID for a proposed deal with no accept yet)."),
      reason: z.string().optional().describe("Optional reason for cancellation."),
      isPreAccept: z.boolean().optional().describe("True if cancelling a proposed deal (no contract ID yet) — posts to tclk-offers instead of the deal room."),
    },
  },
  async ({ contractId, reason, isPreAccept }) => {
    const err = requireIdentity();
    if (err) return err;

    const frame: TclkFrame = {
      type: "cancel",
      from: identity!.did,
      contract: contractId,
      reason,
    };

    const frameLine = encodeFrame(frame);
    const room = isPreAccept ? OFFER_ROOM : dealRoom(contractId);
    const postResult = await postSigned(identity!, room, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting cancel: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ posted: true, room, seq: postResult.seq, frame }, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "post_receipt",
  {
    title: "Post a deal receipt",
    description:
      "Posts a receipt frame to the deal room — a post-terminal acknowledgment of the deal outcome. Optional but good practice.",
    inputSchema: {
      contractId: z.string().describe("The contract ID."),
      outcome: z.enum(["claimed", "refunded", "cancelled"]).describe("The terminal outcome."),
      rail: z.string().optional().describe("Rail that settled it."),
      ref: z.string().optional().describe("Rail-specific settlement reference."),
    },
  },
  async ({ contractId, outcome, rail, ref }) => {
    const err = requireIdentity();
    if (err) return err;

    const frame: TclkFrame = {
      type: "receipt",
      from: identity!.did,
      contract: contractId,
      outcome,
      rail,
      ref,
    };

    const frameLine = encodeFrame(frame);
    const room = dealRoom(contractId);
    const postResult = await postSigned(identity!, room, frameLine);

    if (!postResult.ok) {
      return {
        content: [{ type: "text", text: `Error posting receipt: ${postResult.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ posted: true, room, seq: postResult.seq, frame }, null, 2),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const mode = identity ? `signing as ${identity.did}` : "read-only (no TECHNOCORE_SIGNING_KEY)";
  console.error(`wisp-mcp connected — ${mode} — reading ${BASE_URL}`);
}

main().catch((err) => {
  console.error("wisp-mcp failed to start:", err);
  process.exit(1);
});
