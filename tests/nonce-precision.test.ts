import { test } from "node:test";
import assert from "node:assert/strict";
import { getRoomMessages } from "../src/lib/technocore-client";
import { decodeFrame } from "../src/lib/tclk";

// technocore-chat serialises nonces as JSON numbers. Nanosecond nonces have 19 digits, past 2^53,
// so a plain JSON.parse rounds them (…873 → …800) and a signature over the nonce stops verifying.
const BIG = "1791036846608750873";
const DID = "did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA";

test("room reads keep 19-digit message nonces exact", async (t) => {
  const raw = `{"messages":[{"seq":1,"from":"${DID}","text":"tclk1 {\\"type\\":\\"accept\\",\\"nonce\\":${BIG}}","ts":"2026-10-15T00:00:00Z","nonce":${BIG},"sig":"${"s".repeat(86)}"}]}`;
  t.mock.method(globalThis, "fetch", async () => new Response(raw, { status: 200 }));
  const { messages } = await getRoomMessages("tclk-offers", 1);
  assert.equal(String(messages[0].nonce), BIG);
  assert.equal(messages[0].text, `tclk1 {"type":"accept","nonce":${BIG}}`);
});

test("tclk frames keep 19-digit nonces exact", () => {
  const frame = decodeFrame(`tclk1 {"type":"accept","from":"${DID}","ref":"o1","nonce":${BIG}}`);
  assert.ok(frame && frame.type === "accept");
  assert.equal(frame.nonce, BIG);
  const offer = decodeFrame(`tclk1 {"type":"offer","id":"o1","from":"${DID}","amount":"1","asset":"FLOP","nonce":${BIG}}`);
  assert.ok(offer && offer.type === "offer");
  assert.equal(offer.nonce, BIG);
});
