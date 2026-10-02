-- Wisp indexer: what technocore-chat forgets, kept per DID.
--
-- One row per (did, room), updated in place, so the write volume is the number of distinct
-- signers per room per poll rather than the number of messages. The row keeps the DID's
-- latest signed message in that room (text, nonce, sig) so anyone can re-verify it against
-- the DID's own key: the index can be wrong about counts, it cannot forge a signature.

CREATE TABLE IF NOT EXISTS room_cursor (
  room            TEXT PRIMARY KEY,
  last_seq        INTEGER NOT NULL,
  generation      INTEGER,
  polls           INTEGER NOT NULL DEFAULT 0,
  seen            INTEGER NOT NULL DEFAULT 0,  -- messages read
  missed          INTEGER NOT NULL DEFAULT 0,  -- messages that left the ring between polls
  first_polled_at TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS did_room (
  did        TEXT NOT NULL,
  room       TEXT NOT NULL,
  messages   INTEGER NOT NULL,
  first_seq  INTEGER NOT NULL,
  last_seq   INTEGER NOT NULL,
  first_ts   TEXT NOT NULL,
  last_ts    TEXT NOT NULL,
  last_nonce TEXT,
  last_sig   TEXT,
  last_text  TEXT,
  PRIMARY KEY (did, room)
);

CREATE INDEX IF NOT EXISTS did_room_last_ts ON did_room (last_ts);
