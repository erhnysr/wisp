/**
 * wisp-indexer — a Cloudflare Worker that keeps the per-DID history technocore-chat's room
 * rings drop. A cron pass reads the watched rooms every minute and records the DIDs on the
 * watch list; the fetch handler serves the index as JSON for Wisp (and anyone else).
 */

import { DEFAULT_MAX_WRITES_PER_PASS, ingestAll, parsePositiveInt, parseRooms, type D1Like } from "./ingest";
import { DEFAULT_MAX_TRACKED, isPruneMinute, pruneTracked } from "./tracking";
import { didHistory, health, type Limits } from "./api";

export interface Env {
  DB: D1Like;
  ROOMS: string;
  TECHNOCORE_BASE_URL?: string;
  MAX_TRACKED?: string;
  MAX_WRITES_PER_PASS?: string;
}

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=30",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function limits(env: Env): Limits {
  return {
    maxTracked: parsePositiveInt(env.MAX_TRACKED, DEFAULT_MAX_TRACKED),
    maxWritesPerPass: parsePositiveInt(env.MAX_WRITES_PER_PASS, DEFAULT_MAX_WRITES_PER_PASS),
  };
}

const worker = {
  async scheduled(event: { scheduledTime?: number } | undefined, env: Env): Promise<void> {
    const results = await ingestAll(parseRooms(env.ROOMS), {
      fetch: (input, init) => fetch(input, init),
      db: env.DB,
      base: (env.TECHNOCORE_BASE_URL ?? "https://technocore.chat").replace(/\/$/, ""),
      now: () => new Date(),
      maxWritesPerPass: limits(env).maxWritesPerPass,
    });
    console.log(JSON.stringify(results));
    const at = new Date(event?.scheduledTime ?? Date.now());
    if (isPruneMinute(at)) {
      await pruneTracked(env.DB, at).catch((err) => console.log(`prune failed: ${String(err)}`));
    }
  },

  // GET only. `/did/<did>?watch=1` also adds the DID to the watch list (one row, once): the
  // single write the HTTP side can cause, capped by MAX_TRACKED.
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET") return json(405, { error: "GET only" });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        const r = await health(env.DB, limits(env));
        return json(r.status, r.body);
      }
      if (url.pathname.startsWith("/did/")) {
        const did = decodeURIComponent(url.pathname.slice("/did/".length));
        const r = await didHistory(env.DB, did, {
          track: url.searchParams.get("watch") === "1",
          maxTracked: limits(env).maxTracked,
        });
        return json(r.status, r.body);
      }
      return json(404, { error: "routes: /health, /did/<did:key>[?watch=1]" });
    } catch (err) {
      return json(500, { error: String(err) });
    }
  },
};

export default worker;
