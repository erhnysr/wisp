/**
 * A DID's published identity note — the one per-DID record technocore-chat
 * keeps that outlives the room rings.
 *
 * Convention (technocore-chat manual, "IDENTITY"): fingerprint = the first 16
 * lowercase hex characters of SHA-256(did:key string); new notes live at
 * /kv/did-<first 2>/<remaining 14>, older ones at /kv/did/<fingerprint>.
 * Readers try the sharded path first, then the legacy one.
 *
 * What it is and isn't: notes are world-writable by design, so a note at a
 * DID's path is a *claim* someone published there — usually the key holder,
 * but nothing on the server checks that. It is also reclaimed after 7 idle
 * days. Wisp shows it as exactly that, never as proof of ownership.
 */

import { getNote } from "./technocore-client";

export interface IdentityNote {
  /** The /kv path the note was found at, or the sharded path that was tried. */
  path: string;
  found: boolean;
  /** Whether the note text names this exact did:key. */
  namesThisDid: boolean;
  /** `mailbox:` room advertised for direct messages, if any. */
  mailbox: string | null;
  /** True when an `x25519:` encryption key is published. */
  hasEncryptionKey: boolean;
  /** Settlement rails advertised on a `tclk1:` line (e.g. flop-htlc, x402). */
  tclkRails: string[];
  /** The note body with server banners stripped, capped for display. */
  text: string | null;
  proves: string;
  doesntProve: string;
}

const MAX_TEXT = 600;

export async function didFingerprint(did: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(did));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** Strip the server's "UNTRUSTED CONTENT" banner and the per-caller budget footer. */
export function cleanNoteBody(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.startsWith("!! UNTRUSTED")) {
    lines.shift();
    while (lines.length && lines[0].trim() === "") lines.shift();
  }
  while (lines.length && (lines.at(-1)!.startsWith("# budget:") || lines.at(-1)!.trim() === "")) lines.pop();
  return lines.join("\n");
}

export function parseIdentityNote(did: string, body: string) {
  const tokens = body.split(/[\s,]+/);
  const after = (label: string) => {
    const re = new RegExp(`(?:^|\\s)${label}\\s*:?\\s*(\\S+)`, "i");
    return body.match(re)?.[1] ?? null;
  };
  const rails = after("tclk1");
  return {
    namesThisDid: tokens.includes(did),
    mailbox: after("mailbox"),
    hasEncryptionKey: /(?:^|\s)x25519\s*:/i.test(body),
    tclkRails: rails ? rails.split(",").map((r) => r.trim()).filter(Boolean) : [],
  };
}

const PROVES =
  "Someone published an identity note at this DID's well-known path — usually how a key holder advertises its key, mailbox and settlement rails.";
const DOESNT_PROVE =
  "Notes are world-writable and expire after 7 idle days: this doesn't prove the key holder wrote it, and a missing note doesn't prove the DID is inactive.";

export async function getIdentityNote(did: string): Promise<IdentityNote> {
  const fp = await didFingerprint(did);
  const sharded = { ns: `did-${fp.slice(0, 2)}`, key: fp.slice(2) };
  const legacy = { ns: "did", key: fp };

  for (const loc of [sharded, legacy]) {
    const raw = await getNote(loc.ns, loc.key);
    if (raw === null) continue;
    const body = cleanNoteBody(raw);
    return {
      path: `/kv/${loc.ns}/${loc.key}`,
      found: true,
      ...parseIdentityNote(did, body),
      text: body.length > MAX_TEXT ? `${body.slice(0, MAX_TEXT)}…` : body,
      proves: PROVES,
      doesntProve: DOESNT_PROVE,
    };
  }

  return {
    path: `/kv/${sharded.ns}/${sharded.key}`,
    found: false,
    namesThisDid: false,
    mailbox: null,
    hasEncryptionKey: false,
    tclkRails: [],
    text: null,
    proves: PROVES,
    doesntProve: DOESNT_PROVE,
  };
}
