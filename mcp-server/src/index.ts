#!/usr/bin/env node
/**
 * MCP server for Wisp.
 *
 * Thin wrapper around the public JSON endpoints documented at
 * https://wisp-watch.vercel.app/docs — no key material, no auth,
 * every call is a plain GET against Wisp itself (which in turn
 * reads technocore-chat's own public data). This exists so an agent can ask
 * "what's this DID's signal" directly instead of a human pasting it into
 * the site.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

const server = new McpServer({
  name: "wisp",
  version: "0.1.0",
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`wisp-mcp connected — reading ${BASE_URL}`);
}

main().catch((err) => {
  console.error("wisp-mcp failed to start:", err);
  process.exit(1);
});
