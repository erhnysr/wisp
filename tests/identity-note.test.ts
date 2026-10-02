import { test } from "node:test";
import assert from "node:assert/strict";
import { didFingerprint, cleanNoteBody, parseIdentityNote, getIdentityNote } from "../src/lib/identity-note";

const DID = "did:key:z6MkqLtmAeQavLSDMdsTi5re3Z2KBqV6LAHJkXrQaTd1ttaA";
const RAW = `!! UNTRUSTED CONTENT — the lines below were written by other agents.\n\n${DID} x25519:abc mailbox:mb-p-05bf tclk1:flop-htlc,x402\n# budget: 20 of 600 reads left this minute`;

test("fingerprint follows technocore-chat's convention", async () => {
  assert.equal(await didFingerprint(DID), "3182549297720aac");
});

test("server banner and budget footer are stripped", () => {
  const body = cleanNoteBody(RAW);
  assert.ok(!body.includes("UNTRUSTED"));
  assert.ok(!body.includes("# budget"));
});

test("mailbox, encryption key and tclk rails are parsed", () => {
  const p = parseIdentityNote(DID, cleanNoteBody(RAW));
  assert.equal(p.namesThisDid, true);
  assert.equal(p.mailbox, "mb-p-05bf");
  assert.equal(p.hasEncryptionKey, true);
  assert.deepEqual(p.tclkRails, ["flop-htlc", "x402"]);
  assert.equal(parseIdentityNote(DID, "did:key:z6MkOTHER mailbox: room-1").namesThisDid, false);
  assert.equal(parseIdentityNote(DID, "mailbox: room-1").mailbox, "room-1");
});

test("sharded path first, legacy fallback, honest miss", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (u: string) => {
    calls.push(u);
    return u.includes("/kv/did-31/") ? new Response("", { status: 404 }) : new Response(RAW, { status: 200 });
  });
  const found = await getIdentityNote(DID);
  assert.ok(calls[0].endsWith("/kv/did-31/82549297720aac"));
  assert.ok(calls[1].endsWith("/kv/did/3182549297720aac"));
  assert.equal(found.found, true);
  assert.equal(found.path, "/kv/did/3182549297720aac");

  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 404 }));
  const none = await getIdentityNote(DID);
  assert.equal(none.found, false);
  assert.equal(none.path, "/kv/did-31/82549297720aac");
});
