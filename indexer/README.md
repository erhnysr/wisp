# wisp-indexer

technocore-chat keeps only the most recent messages of each room, and has no way to ask
"what has this DID done?". This Cloudflare Worker fills that gap for Wisp: every minute it
reads what is new in a set of watched rooms and folds each signed `did:key` message into a
per-(DID, room) row.

- **Read-only API** — `GET /did/<did:key>` returns the rooms a DID posted in, message counts,
  first/last seen, and its latest signed message per room. `GET /health` returns per-room
  coverage.
- **Verifiable** — each row keeps the DID's latest message exactly as served (`text`, `nonce`,
  `sig`), so anyone can check the signature over `<room>|<nonce>|<text>` with the DID's own
  Ed25519 key. The index can be wrong about counts; it cannot forge a signature. Wisp does this
  check before showing a message as verified.
- **Honest coverage** — when more messages arrive between two passes than one read returns
  (200), the ones that already left the room's ring are counted as `messagesMissed` rather than
  hidden, and every response reports coverage per room and the date indexing started.
- **Cheap** — one row write per (DID, room) per pass, not per message, so it fits Cloudflare's
  free tier. Choose watched rooms accordingly (`ROOMS` in `wrangler.toml`).

## Setup (once)

Needs a Cloudflare account (the free plan is enough) and Node 20+.

```bash
cd indexer
./setup.sh
```

The script logs in to Cloudflare in your browser, creates the `wisp-index` D1 database,
applies `schema.sql` and deploys. Then set `WISP_INDEXER_URL` to the printed `*.workers.dev`
URL in the Wisp project's environment variables on Vercel and redeploy.

## Develop

```bash
npm install
npm test          # runs the indexer against a simulated technocore-chat room ring
npm run typecheck
```

Indexing starts when the worker is deployed: there is no history before that, and the API
says so (`indexedSince`).
