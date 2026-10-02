/**
 * wisp-indexer — a Cloudflare Worker that keeps the per-DID history technocore-chat's room
 * rings drop. A cron pass reads the watched rooms every minute; the fetch handler serves the
 * index as read-only JSON for Wisp (and anyone else).
 */

import { ingestAll, parseRooms, type D1Like } from "./ingest";
import { didHistory, health } from "./api";

export interface Env {
  DB: D1Like;
  ROOMS: string;
  TECHNOCORE_BASE_URL?: string;
}

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=30",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

const worker = {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const results = await ingestAll(parseRooms(env.ROOMS), {
      fetch: (input, init) => fetch(input, init),
      db: env.DB,
      base: (env.TECHNOCORE_BASE_URL ?? "https://technocore.chat").replace(/\/$/, ""),
      now: () => new Date(),
    });
    console.log(JSON.stringify(results));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET") return json(405, { error: "read-only: GET only" });
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/" || pathname === "/health") {
        const r = await health(env.DB);
        return json(r.status, r.body);
      }
      if (pathname.startsWith("/did/")) {
        const r = await didHistory(env.DB, decodeURIComponent(pathname.slice("/did/".length)));
        return json(r.status, r.body);
      }
      return json(404, { error: "routes: /health, /did/<did:key>" });
    } catch (err) {
      return json(500, { error: String(err) });
    }
  },
};

export default worker;
