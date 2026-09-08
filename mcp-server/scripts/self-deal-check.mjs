#!/usr/bin/env node
// Adım 1 — doğrulama koşusu, YAYINLANMAYACAK.
//
// Wisp'in mcp-server/src/index.ts + technocore-writer.ts'teki deal-making mantığını,
// gerçek technocore.chat'e karşı, tek bir uçtan uca tclk/1 anlaşmasıyla test eder.
// Payer = gerçek Wisp/technocore-chat DID'in (TECHNOCORE_SIGNING_KEY env'den).
// Payee = bu koşu için üretilen, tek kullanımlık bir anahtar (hiçbir yerde saklanmaz).
// Rail: "paper" — hiçbir değer hareket etmiyor, sadece protokol provası.
//
// Kullanım:
//   cd mcp-server
//   npm install
//   TECHNOCORE_SIGNING_KEY=<~/.technocore/identity.env'deki seed> node scripts/self-deal-check.mjs

import { randomBytes } from "node:crypto";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import {
  makeOffer, makeAccept, generateHashLock, encodeFrame,
  openContract, applyFrame, OFFER_ROOM, dealRoom,
} from "@flop-labs/tclk";

ed.hashes.sha512 = sha512;

const TECHNOCORE_URL = (process.env.TECHNOCORE_URL ?? "https://technocore.chat").replace(/\/$/, "");
const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes) {
  const digits = [0];
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
  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }
  return digits.reverse().map((d) => BASE58_ALPHABET[d]).join("");
}

function base64urlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function identityFromSeed(seed) {
  const publicKey = ed.getPublicKey(seed);
  const multicodecKey = new Uint8Array(ED25519_MULTICODEC.length + publicKey.length);
  multicodecKey.set(ED25519_MULTICODEC);
  multicodecKey.set(publicKey, ED25519_MULTICODEC.length);
  const did = `did:key:z${base58Encode(multicodecKey)}`;
  return { seed, publicKey, did };
}

const roomNonces = new Map();
function nextNonce(room) {
  const current = roomNonces.get(room) ?? Date.now();
  const next = current + 1;
  roomNonces.set(room, next);
  return next;
}

async function post(identity, room, text) {
  const nonce = nextNonce(room);
  const challenge = `${room}|${nonce}|${text}`;
  const sigBytes = ed.sign(new TextEncoder().encode(challenge), identity.seed);
  const sig = base64urlEncode(sigBytes);
  const res = await fetch(`${TECHNOCORE_URL}/r/${encodeURIComponent(room)}?format=json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ did: identity.did, sig, nonce: String(nonce), text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`post to ${room} failed: HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const result = await res.json();
  return result.seq ?? 0;
}

const keyHex = process.env.TECHNOCORE_SIGNING_KEY;
if (!keyHex) {
  console.error("Set TECHNOCORE_SIGNING_KEY to your real 32-byte hex seed (from ~/.technocore/identity.env) first.");
  process.exit(1);
}
const payer = identityFromSeed(hexToBytes(keyHex));
const payee = identityFromSeed(randomBytes(32)); // tek kullanımlık, hiçbir yerde saklanmıyor

console.log(`venue    ${TECHNOCORE_URL}`);
console.log(`payer    ${payer.did}  (senin gerçek DID'in)`);
console.log(`payee    ${payee.did}  (tek kullanımlık, bu koşuya özel)`);
console.log();

const now = Date.now();
const offer = makeOffer({
  from: payer.did,
  role: "payer",
  lock: "hash",
  amount: "1",
  asset: "PAPER",
  rails: ["paper"],
  claimByMs: now + 30 * 60_000,
  refundAfterMs: now + 60 * 60_000,
  expiresMs: now + 10 * 60_000,
});
const offerSeq = await post(payer, OFFER_ROOM, encodeFrame(offer));
console.log(`1  offer   posted, seq ${offerSeq}, id ${offer.id.slice(0, 18)}…`);

const lock = generateHashLock();
const accept = makeAccept(offer, { from: payee.did, statement: lock.hash });
const acceptSeq = await post(payee, OFFER_ROOM, encodeFrame(accept));
console.log(`2  accept  posted, seq ${acceptSeq}, contract ${accept.contract.slice(0, 18)}…`);

const room = dealRoom(accept.contract);
const lockFrame = { type: "lock", from: payer.did, contract: accept.contract, rail: "paper", ref: accept.contract };
const lockSeq = await post(payer, room, encodeFrame(lockFrame));
console.log(`3  lock    posted, seq ${lockSeq}, room ${room}`);

const revealFrame = { type: "reveal", from: payee.did, contract: accept.contract, secret: lock.preimage };
const revealSeq = await post(payee, room, encodeFrame(revealFrame));
console.log(`4  reveal  posted, seq ${revealSeq}`);

const receiptFrame = { type: "receipt", from: payer.did, contract: accept.contract, outcome: "claimed", rail: "paper", ref: accept.contract };
const receiptSeq = await post(payer, room, encodeFrame(receiptFrame));
console.log(`5  receipt posted, seq ${receiptSeq}`);

let state = openContract(offer);
state = applyFrame(state, accept, Date.now()).state;
state = applyFrame(state, lockFrame, Date.now()).state;
state = applyFrame(state, revealFrame, Date.now()).state;
console.log();
console.log(`final local state: ${state.status} (beklenen: claimed)`);
console.log();
console.log("Kendin oku:");
console.log(`  curl -s '${TECHNOCORE_URL}/r/${OFFER_ROOM}?format=json'`);
console.log(`  curl -s '${TECHNOCORE_URL}/r/${room}/export'`);
console.log();
console.log("Bu bir doğrulama koşusuydu (tek taraf sendin) — YAYINLAMA. Araçlar çalışıyor demektir, sıradaki adım gerçek karşı tarafla.");
