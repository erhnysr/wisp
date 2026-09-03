/**
 * Technocore-chat signed write client.
 *
 * Signs and posts messages to technocore rooms using Ed25519 (did:key).
 * The signing key is provided via TECHNOCORE_SIGNING_KEY env var (32-byte hex seed).
 *
 * Signature covers: `<room>|<nonce>|<text>` as UTF-8
 * Format: base64url, unpadded, 86 chars
 */

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// noble/ed25519 v3 requires setting the SHA-512 hash via hashes
ed.hashes.sha512 = sha512;

const TECHNOCORE_URL = (
  process.env.TECHNOCORE_URL ?? "https://technocore.chat"
).replace(/\/$/, "");

/** Multicodec prefix for Ed25519 public key (0xed01) */
const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

/** Base58btc alphabet (same as Bitcoin) */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  // Leading zeros
  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }
  return digits
    .reverse()
    .map((d) => BASE58_ALPHABET[d])
    .join("");
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export interface SigningIdentity {
  seed: Uint8Array;
  publicKey: Uint8Array;
  did: string;
}

/** Load signing identity from TECHNOCORE_SIGNING_KEY env var. */
export function loadSigningIdentity(): SigningIdentity | null {
  const keyHex = process.env.TECHNOCORE_SIGNING_KEY;
  if (!keyHex) return null;

  const seed = hexToBytes(keyHex);
  if (seed.length !== 32) return null;

  const publicKey = ed.getPublicKey(seed);

  // Encode as did:key (multibase base58btc with ed25519 multicodec prefix)
  const multicodecKey = new Uint8Array(ED25519_MULTICODEC.length + publicKey.length);
  multicodecKey.set(ED25519_MULTICODEC);
  multicodecKey.set(publicKey, ED25519_MULTICODEC.length);
  const did = `did:key:z${base58Encode(multicodecKey)}`;

  return { seed, publicKey, did };
}

/** Nonce tracker — monotonic per room. */
const roomNonces = new Map<string, number>();

function nextNonce(room: string): number {
  const current = roomNonces.get(room) ?? Date.now();
  const next = current + 1;
  roomNonces.set(room, next);
  return next;
}

/**
 * Sign and post a message to a technocore-chat room.
 * Returns the posted message's sequence number on success.
 */
export async function postSigned(
  identity: SigningIdentity,
  room: string,
  text: string,
): Promise<{ ok: true; seq: number } | { ok: false; error: string }> {
  const nonce = nextNonce(room);

  // Sign: <room>|<nonce>|<text>
  const challenge = `${room}|${nonce}|${text}`;
  const challengeBytes = new TextEncoder().encode(challenge);
  const sigBytes = ed.sign(challengeBytes, identity.seed);
  const sig = base64urlEncode(sigBytes);

  try {
    const res = await fetch(`${TECHNOCORE_URL}/r/${encodeURIComponent(room)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        did: identity.did,
        sig,
        nonce,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const result = await res.json() as { seq?: number };
    return { ok: true, seq: result.seq ?? 0 };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
