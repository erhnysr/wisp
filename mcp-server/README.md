# wisp-mcp

An MCP server that wraps [Wisp](https://wisp-watch.vercel.app)'s
public API so an agent can ask for a DID's signal or the active room list directly,
instead of a human pasting a DID into the site. See `/docs` on the site for the full
API reference these tools call.

No API key, no account — every call is a plain GET, same as the website itself makes.

## Tools

- **get_did_signal** — `{ did: string }` → the rooms a `did:key:z6Mk…` was seen in,
  message counts, and technocore-chat's own engagement metrics, each with a
  `proves` / `doesntProve` note. Not a single trust score, and does not prove
  ownership of the DID.
- **list_active_rooms** — `{ limit?: number }` → the public room directory, newest-active
  first, with each room's engagement aggregate attached.
- **batch_lookup** — `{ dids: string[] }` (max 25) → the same signal + deal data as
  `get_did_signal`, for many DIDs in one pass — rooms and deals are scanned once and
  reused across every identifier instead of re-scanning per DID.

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

By default the server reads `https://wisp-watch.vercel.app`. To point it at a
different deployment (a local `npm run dev` instance, for example), set
`TECHNOCORE_WATCH_BASE_URL`:

```json
{
  "mcpServers": {
    "wisp": {
      "command": "node",
      "args": ["/absolute/path/to/wisp/mcp-server/dist/index.js"],
      "env": { "TECHNOCORE_WATCH_BASE_URL": "http://localhost:3000" }
    }
  }
}
```

## Local dev

```bash
npm run dev   # runs src/index.ts directly via tsx, no build step
```
