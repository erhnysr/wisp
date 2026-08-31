/**
 * did:key (Ed25519) decode + validation.
 *
 * technocore-chat only accepts did:key:z6Mk... (Ed25519, multicodec 0xed01).
 * We decode fully client-side — no key material ever leaves the browser,
 * and this module never touches a private key, only public identifiers
 * and (optionally) signatures the user already produced elsewhere.
 */

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

export interface ParsedDid {
  did: string;
  /** Raw 32-byte Ed25519 public key. */
  publicKey: Uint8Array;
  /** Shortened form for display, e.g. "z6Mkih2j…VcUn". */
  short: string;
}

export type DidParseResult =
  | { ok: true; value: ParsedDid }
  | { ok: false; error: string };

function base58btcDecode(input: string): Uint8Array {
  const ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const map = new Map<string, number>();
  for (let i = 0; i < ALPHABET.length; i++) map.set(ALPHABET[i], i);

  let num = 0n;
  for (const char of input) {
    const value = map.get(char);
    if (value === undefined) {
      throw new Error(`Invalid base58 character: "${char}"`);
    }
    num = num * 58n + BigInt(value);
  }

  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }

  // Leading '1' characters encode leading zero bytes.
  for (const char of input) {
    if (char === "1") bytes.unshift(0);
    else break;
  }

  return new Uint8Array(bytes);
}

function shortenDid(did: string): string {
  const key = did.replace("did:key:", "");
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

/** Parses and validates a `did:key:z6Mk...` string. Never throws. */
export function parseDid(input: string): DidParseResult {
  const did = input.trim();

  if (!did.startsWith("did:key:z")) {
    return {
      ok: false,
      error: "DID must look like `did:key:z...` (only Ed25519 is supported).",
    };
  }

  const multibaseValue = did.slice("did:key:".length);
  if (!multibaseValue.startsWith("z")) {
    return { ok: false, error: "Only base58btc (`z`-prefixed) DIDs are supported." };
  }

  let decoded: Uint8Array;
  try {
    decoded = base58btcDecode(multibaseValue.slice(1));
  } catch {
    return {
      ok: false,
      error: "Couldn't decode this DID as base58 — a character may have dropped while copying.",
    };
  }

  if (
    decoded.length !== 34 ||
    decoded[0] !== ED25519_MULTICODEC_PREFIX[0] ||
    decoded[1] !== ED25519_MULTICODEC_PREFIX[1]
  ) {
    return {
      ok: false,
      error: "This doesn't look like an Ed25519 did:key (multicodec prefix mismatch).",
    };
  }

  return {
    ok: true,
    value: {
      did,
      publicKey: decoded.slice(2),
      short: shortenDid(did),
    },
  };
}
