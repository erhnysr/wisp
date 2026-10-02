#!/usr/bin/env node
/**
 * Health-check watchdog for the live Wisp deployment.
 *
 * Same pattern as an earlier pr-watchdog project: watch → check → report.
 * Here there's no PR to watch, so it watches the deployed site itself —
 * hits the routes a real visitor/integrator depends on and fails loudly
 * (a GitHub issue) if any of them break. Exits non-zero on failure so the
 * Action run itself is also visibly red, independent of the issue.
 */

const BASE_URL = (process.env.TECHNOCORE_WATCH_BASE_URL ?? "https://wisp-watch.vercel.app").replace(
  /\/$/,
  "",
);

// Any syntactically valid Ed25519 did:key works here — /api/card renders an
// image for a bad DID too, but a well-formed one exercises the real scan
// path (technocore-chat round trip) instead of just the error branch.
const SAMPLE_DID = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

async function getJson(path, init) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error("response is not JSON");
  }
}

// Every public route a visitor or integrator depends on. Each check asserts the
// response shape, not just a 200, so a route that silently returns an empty or
// malformed payload (e.g. after an upstream technocore-chat change) still fails.
const CHECKS = [
  {
    name: "/docs responds",
    run: async () => {
      const res = await fetch(`${BASE_URL}/docs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
  },
  {
    name: "/api/rooms returns a non-empty room array",
    run: async () => {
      const body = await getJson("/api/rooms?limit=5");
      if (!Array.isArray(body.rooms)) throw new Error("response has no `rooms` array");
      if (body.rooms.length === 0) throw new Error("`rooms` is empty — upstream may have changed");
    },
  },
  {
    name: "/api/lookup answers for a well-formed DID",
    run: async () => {
      const body = await getJson(`/api/lookup?did=${encodeURIComponent(SAMPLE_DID)}`);
      if (body?.did !== SAMPLE_DID || typeof body.roomsScanned !== "number") {
        throw new Error(`unexpected body: ${JSON.stringify(body).slice(0, 160)}`);
      }
    },
  },
  {
    name: "/api/lookup rejects a malformed DID with 400",
    run: async () => {
      const res = await fetch(`${BASE_URL}/api/lookup?did=not-a-did`);
      if (res.status !== 400) throw new Error(`expected HTTP 400, got ${res.status}`);
    },
  },
  {
    name: "/api/lookup/bulk answers a one-DID batch",
    run: async () => {
      await getJson("/api/lookup/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dids: [SAMPLE_DID] }),
      });
    },
  },
  {
    name: "/api/feed returns JSON",
    run: async () => {
      await getJson("/api/feed");
    },
  },
  {
    name: "/api/deals returns JSON",
    run: async () => {
      await getJson("/api/deals");
    },
  },
  {
    name: "/api/deals/analytics returns JSON",
    run: async () => {
      await getJson("/api/deals/analytics");
    },
  },
  {
    name: "/api/deals/feed.xml returns an Atom feed",
    run: async () => {
      const res = await fetch(`${BASE_URL}/api/deals/feed.xml`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("atom")) throw new Error(`expected Atom, got content-type "${contentType}"`);
    },
  },
  {
    name: "/api/card renders a PNG",
    run: async () => {
      const res = await fetch(`${BASE_URL}/api/card?did=${encodeURIComponent(SAMPLE_DID)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("image")) throw new Error(`expected an image, got content-type "${contentType}"`);
    },
  },
];

const failures = [];

for (const check of CHECKS) {
  try {
    await check.run();
    console.log(`OK   ${check.name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`FAIL ${check.name} — ${message}`);
    failures.push({ name: check.name, message });
  }
}

const summaryPath = process.env.GITHUB_OUTPUT;
if (summaryPath) {
  const fs = await import("node:fs");
  const failed = failures.length > 0;
  const body = failed
    ? [
        `Wisp (${BASE_URL}) failed ${failures.length}/${CHECKS.length} health checks.`,
        "",
        ...failures.map((f) => `- **${f.name}**: ${f.message}`),
        "",
        `Checked at ${new Date().toISOString()}.`,
      ].join("\n")
    : "";
  fs.appendFileSync(summaryPath, `failed=${failed}\n`);
  fs.appendFileSync(summaryPath, `body<<WATCHDOG_EOF\n${body}\nWATCHDOG_EOF\n`);
}

if (failures.length > 0) process.exit(1);
