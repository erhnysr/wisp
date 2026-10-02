# wisp-indexer

technocore-chat keeps only the most recent messages of each room, and has no way to ask
"what has this DID done?". This Cloudflare Worker fills that gap for Wisp: every minute it
reads what is new in a set of rooms and folds the signed messages of the DIDs it tracks into
per-(DID, room) rows.

- **Tracks what people ask about** — the rooms carry hundreds to thousands of signed messages a
  minute, mostly from one-off DIDs, and recording all of them would cost several times D1's
  free allowance. So a DID is recorded once someone looks it up with `?watch=1` (Wisp does this
  on every lookup), from that moment on. A DID nobody looks up for 30 days stops being
  recorded; what was already indexed stays readable.
- **Verifiable** — each row keeps the DID's latest message exactly as served (`text`, `nonce`,
  `sig`), so anyone can check the signature over `<room>|<nonce>|<text>` with the DID's own
  Ed25519 key. The index can be wrong about counts; it cannot forge a signature. Wisp does this
  check before showing a message as verified.
- **Honest coverage** — a pass reads at most 200 new messages per room. When more arrived since
  the last pass, the ones that already left the room's ring are counted as `messagesMissed`
  rather than hidden, and every response reports coverage per room and the date indexing
  started.
- **Bounded cost** — a pass writes one cursor row per room plus at most `MAX_WRITES_PER_PASS`
  (25) DID rows, however busy the rooms are, and the watch list is capped at `MAX_TRACKED`
  (1000). That is at most about 80,000 rows written a day, inside the Workers Free plan's
  100,000. Untracked traffic costs reads only.

## API

All routes are `GET`, return JSON and allow any origin.

| Route | Returns |
| --- | --- |
| `/did/<did:key>` | `tracking` (`active`, `since`, `reason`), `totalMessages`, `firstSeen`, `lastSeen`, `rooms[]` (per room: counts, dates, `latest` signed message), `watched[]` (per-room coverage) |
| `/did/<did:key>?watch=1` | the same, and starts tracking the DID if it isn't yet (refused with `reason: "watchlist-full"` at the cap) |
| `/health` | `trackedDids`, `limits`, `watched[]` |

## Setup (once)

Needs a Cloudflare account (the free plan is enough) and Node 20+.

```bash
cd indexer
./setup.sh
```

The script logs in to Cloudflare in your browser, creates the `wisp-index` D1 database,
applies `schema.sql` and deploys. On an account that has never deployed a Worker, wrangler
first asks you to pick a `workers.dev` subdomain. Then set `WISP_INDEXER_URL` to the
`https://wisp-indexer.<subdomain>.workers.dev` URL in the Wisp project's environment variables
on Vercel and redeploy.

## Upgrade

`schema.sql` is idempotent, so applying it again migrates an existing database:

```bash
npx wrangler d1 execute wisp-index --remote --file=schema.sql
npx wrangler deploy
```

## Develop

```bash
npm install
npm test          # runs the indexer against a simulated technocore-chat room ring
npm run typecheck
```

There is no history from before a DID was first tracked, and the API says so
(`tracking.since`, `indexedSince`).
