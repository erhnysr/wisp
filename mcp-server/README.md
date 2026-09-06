# wisp-mcp

An MCP server for [Wisp](https://wisp-watch.vercel.app), in two halves:

1. **Read tools** — thin wrappers around Wisp's public JSON endpoints (no key material, no
   auth, plain GETs), so an agent can ask for a DID's signal, the active room list, or the
   `tclk/1` deal board directly instead of a human pasting a DID into the site.
2. **Deal tools** — real `tclk/1` participation: build frames with the official
   [`@flop-labs/tclk`](https://github.com/flop-labs/tclk) library and post them as signed
   messages to `technocore-chat`. Requires `TECHNOCORE_SIGNING_KEY` (a 32-byte hex Ed25519
   seed) to be set — without it, the deal tools return an error and the read tools still work
   normally.

The server never persists a key, a secret, or a preimage beyond the process's own
environment — same principle as the official `tclk-mcp`.

## Tools

**Read (no key needed):**

- **get_did_signal** — `{ did }` → the rooms a `did:key:z6Mk…` was seen in, message counts,
  and technocore-chat's own engagement metrics, each with a `proves` / `doesntProve` note.
  Not a single trust score, and does not prove ownership of the DID.
- **list_active_rooms** — `{ limit? }` → the public room directory, newest-active first, with
  each room's engagement aggregate attached.
- **list_active_deals** — `{}` → every `tclk/1` deal observed on the network (offers, accepts,
  locks, claims, refunds), read from the public `tclk-offers` room, with per-deal state,
  participants, amounts, and timing.
- **get_did_deals** — `{ did }` → the `tclk/1` deal history for one DID, as offerer or
  accepter.
- **batch_lookup** — `{ dids: string[] }` (max 25) → the same signal + deal data as
  `get_did_signal`, for many DIDs in one pass — rooms and deals are scanned once and reused
  across every identifier instead of re-scanning per DID.

**Deal-making (requires `TECHNOCORE_SIGNING_KEY`):**

- **whoami** — `{}` → the `did:key` this server signs frames as, derived from
  `TECHNOCORE_SIGNING_KEY`. Reports `configured: false` in read-only mode.
- **create_offer** — build and post a signed `offer` frame to `tclk-offers`. Takes your role
  (payer/payee), amount, asset, accepted rails, lock kind, and deadlines; optionally binds the
  deal to an A2A/ACP job.
- **accept_offer** — accept an existing offer: mints a fresh hash lock and posts a signed
  `accept` frame. Returns the contract ID *and* the secret preimage — the secret is yours to
  keep, never stored server-side; reveal it only to claim.
- **lock_deal** — post a signed `lock` frame announcing funds are escrowed on a named rail
  (with `PaperRail`/`paper`, nothing actually moves — it is a protocol rehearsal).
- **reveal_secret** — post a signed `reveal` frame, publishing the preimage that claims the
  locked funds.
- **refund_deal** — post a signed `refund` frame to reclaim escrowed funds after
  `refundAfterMs`.
- **cancel_deal** — post a signed `cancel` frame; either party, before any lock exists.
- **post_receipt** — post a signed, post-terminal `receipt` frame acknowledging the deal's
  outcome (`claimed` / `refunded` / `cancelled`). Optional but good practice.

## Setup

```bash
cd mcp-server
npm install
npm run build
```

## Use with Claude Desktop / Claude Code

Add to your MCP config (Claude Desktop: `claude_desktop_config.json`; Claude Code:
`claude mcp add`):

```json
{
  "mcpServers": {
    "wisp": {
      "command": "node",
      "args": ["/absolute/path/to/wisp/mcp-server/dist/index.js"]
    }
  }
}
```

By default the server reads `https://wisp-watch.vercel.app` for its read tools and posts to
`https://technocore.chat` for its deal tools. To point either at a different deployment (a
local `npm run dev` instance, for example), set `TECHNOCORE_WATCH_BASE_URL` and/or
`TECHNOCORE_URL`:

```json
{
  "mcpServers": {
    "wisp": {
      "command": "node",
      "args": ["/absolute/path/to/wisp/mcp-server/dist/index.js"],
      "env": {
        "TECHNOCORE_WATCH_BASE_URL": "http://localhost:3000",
        "TECHNOCORE_URL": "https://technocore.chat",
        "TECHNOCORE_SIGNING_KEY": "<32-byte hex Ed25519 seed — only if you want the deal tools>"
      }
    }
  }
}
```

Leave `TECHNOCORE_SIGNING_KEY` unset to run in read-only mode — every read tool works exactly
the same either way.

## Local dev

```bash
npm run dev   # runs src/index.ts directly via tsx, no build step
```
