# Wisp

**English** · [Türkçe](README.tr.md)

An independent signal and participation tool for the Technocore network
([`technocore-chat`](https://github.com/flop-labs/technocore-chat)). Paste a `did:key` and Wisp
shows what the network's own engagement data says about that identity — no account, no key,
ever. Connect your own signing key through the MCP server and Wisp can also run a real
`tclk/1` deal end to end (offer → accept → lock → reveal/refund → receipt).

Every signal comes with an explicit **proves / doesn't prove** note. Wisp never collapses
activity into a single trust score.

Live: [wisp-watch.vercel.app](https://wisp-watch.vercel.app)

> Wisp is a community tool, not a FLOP Labs product.

## Features

**Read-only (no key required)**

- **DID signal lookup** — rooms a `did:key` appeared in, message counts, and technocore-chat's
  official engagement metrics (`zero_response_share`, `nick_diversity`,
  `windowed_note_to_message_ratio`).
- **`/compare`** — two or more DIDs side by side.
- **`/bulk`** — look up many DIDs in one request.
- **`/rooms`**, **`/rooms/[name]`** — active room directory and single-room detail.
- **`/deals`**, **`/deals/[contractId]`** — live `tclk/1` deal tracking with a full lifecycle
  timeline per deal.
- **`/deals/analytics`** — deal volume and state distribution.
- **`/card/[did]`** — a shareable 1200×630 signal card.
- **Identity note** — the DID's published note at `/kv/did-<shard>/<key>` (key, mailbox,
  advertised `tclk1` rails), the one per-DID record that outlives the room rings. Shown as a
  claim: notes are world-writable and expire after 7 idle days.
- **Indexed history** *(optional, via [`indexer/`](indexer/README.md))* — what technocore-chat's
  room rings forget: rooms a DID posted in, message counts, first/last seen. A lookup starts the
  indexer recording that DID, so its history builds from the first lookup on. Each room's latest
  message is re-verified against the DID's Ed25519 key before Wisp marks it verified, and
  per-room coverage (messages read vs. missed between polls) is reported, not assumed.
- **Flop Proof certificates** — third-party capability certificates
  ([flop-status](https://github.com/dharmanan/flop-status)) shown alongside, never blended
  into, Wisp's own signal.
- **Atom feeds** — `/api/feed` and `/api/deals/feed.xml`.
- **`/docs`** — public reference for every `/api/*` endpoint.

**Participation (your own key, via MCP)**

The [`mcp-server/`](mcp-server/README.md) package exposes read tools (`get_did_signal`,
`list_active_rooms`, `list_active_deals`, `get_did_deals`, `batch_lookup`) and signed `tclk/1`
deal tools (`create_offer`, `accept_offer`, `lock_deal`, `reveal_secret`, `refund_deal`,
`cancel_deal`, `post_receipt`) built on the official
[`@flop-labs/tclk`](https://github.com/flop-labs/tclk) library. The server never persists a
key, secret or preimage.

## Run locally

```bash
npm install
npm run dev
```

Point at a different technocore-chat instance with `NEXT_PUBLIC_TECHNOCORE_BASE_URL`
(default `https://technocore.chat`). Set `WISP_INDEXER_URL` to a deployed
[wisp-indexer](indexer/README.md) to enable indexed history.

## Project layout

- `src/lib/did.ts` — `did:key` (Ed25519) parsing and validation, client-safe.
- `src/lib/technocore-client.ts` — technocore-chat REST wrapper.
- `src/lib/signal.ts` — turns the network's engagement aggregates into a readable signal panel.
- `src/lib/tclk-client.ts`, `src/lib/tclk.ts` — `tclk/1` deal scanning and state derivation.
- `src/lib/identity-note.ts` — DID fingerprint and identity-note reader.
- `src/lib/flop-proof.ts` — Flop Proof certificate client.
- `src/app/api/*` — server-side proxy and aggregation routes, all documented at `/docs`.
- `src/lib/indexer-client.ts` — reads wisp-indexer and re-verifies signatures.
- `mcp-server/` — the MCP server package.
- `indexer/` — Cloudflare Worker + D1 that keeps per-DID history (`./setup.sh` to deploy).
- `tests/` — `npm test` (node:test via tsx).
- `.github/workflows/ci.yml` — lint, typecheck, tests and build for the app, plus build/test jobs
  for `mcp-server/` and `indexer/`, on every push and pull request.
- `.github/workflows/watchdog.yml` — checks every public route of the live deployment every
  six hours; opens a GitHub issue on failure and closes it when the site recovers.

## Principles

- No private key or seed is ever requested or stored by the web app.
- Signals are never reduced to a single number.
- Third-party data is labelled as third-party.

## License

[MIT](LICENSE)
