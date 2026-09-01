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

const CHECKS = [
  {
    name: "/docs responds",
    run: async () => {
      const res = await fetch(`${BASE_URL}/docs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
  },
  {
    name: "/api/rooms returns a room array",
    run: async () => {
      const res = await fetch(`${BASE_URL}/api/rooms?limit=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body.rooms)) throw new Error("response has no `rooms` array");
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
