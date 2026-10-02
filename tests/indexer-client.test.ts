import { test } from "node:test";
import assert from "node:assert/strict";
import { ed25519 } from "@noble/curves/ed25519.js";
import { verifyRoomMessage, getIndexedHistory } from "../src/lib/indexer-client";

function base58(bytes: Uint8Array): string {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) { out = A[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

const sk = ed25519.utils.randomSecretKey();
const pk = ed25519.getPublicKey(sk);
const did = "did:key:z" + base58(new Uint8Array([0xed, 0x01, ...pk]));
const room = "lobby";
const nonce = "1790940000000";
const text = '{"t":"hello"}';
const sig = Buffer.from(ed25519.sign(new TextEncoder().encode(`${room}|${nonce}|${text}`), sk)).toString("base64url");

test("verifies technocore's signed-lane string and fails closed otherwise", () => {
  assert.equal(sig.length, 86);
  assert.equal(verifyRoomMessage(pk, room, { seq: 1, nonce, sig, text }), true);
  assert.equal(verifyRoomMessage(pk, "other-room", { seq: 1, nonce, sig, text }), false);
  assert.equal(verifyRoomMessage(pk, room, { seq: 1, nonce, sig, text: text + " " }), false);
  assert.equal(verifyRoomMessage(pk, room, { seq: 1, nonce: null, sig: null, text }), null);
  assert.equal(verifyRoomMessage(pk, room, { seq: 1, nonce, sig: "garbage", text }), false);
});

test("no indexer configured means no history, not an error", async () => {
  delete process.env.WISP_INDEXER_URL;
  assert.equal(await getIndexedHistory(did), null);
});

test("rows the indexer cannot back with a signature are marked unverified", async (t) => {
  process.env.WISP_INDEXER_URL = "https://idx.example/";
  let called = "";
  t.mock.method(globalThis, "fetch", async (u: string) => {
    called = u;
    return Response.json({
      did, totalMessages: 7, firstSeen: "a", lastSeen: "b", watched: [],
      rooms: [
        { room, messages: 2, firstSeen: "a", lastSeen: "b", latest: { seq: 9, nonce, sig, text } },
        { room: "forged", messages: 5, firstSeen: "a", lastSeen: "b", latest: { seq: 3, nonce, sig, text } },
      ],
    });
  });
  const h = await getIndexedHistory(did);
  assert.equal(called, `https://idx.example/did/${encodeURIComponent(did)}`);
  assert.equal(h?.rooms[0].verified, true);
  assert.equal(h?.rooms[1].verified, false);
});

test("a response for another DID or an outage yields null", async (t) => {
  process.env.WISP_INDEXER_URL = "https://idx.example";
  t.mock.method(globalThis, "fetch", async () => Response.json({ did: "did:key:z6Mkother", rooms: [], watched: [] }));
  assert.equal(await getIndexedHistory(did), null);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("down"); });
  assert.equal(await getIndexedHistory(did), null);
});
