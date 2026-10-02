-- Wisp indexer: what technocore-chat forgets, kept per DID.
--
-- The watched rooms carry hundreds to thousands of signed messages a minute, most of them from
-- one-off DIDs. Recording every signer would cost hundreds of row writes a minute, several
-- times the 100,000 rows a day D1 allows on the Workers Free plan. So the indexer records only
-- DIDs someone asked about: a DID enters `watch` the first time it is looked up with
-- `?watch=1` (Wisp does this), and its activity is indexed from then on.
--
-- One row per (did, room), updated in place. The row keeps the DID's latest signed message in
-- that room (text, nonce, sig) so anyone can re-verify it against the DID's own key: the index
-- can be wrong about counts, it cannot forge a signature.
--
-- Every statement is idempotent: re-running this file is also how an existing database
-- migrates to the current schema.

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

CREATE TABLE IF NOT EXISTS watch (
  did         TEXT PRIMARY KEY,
  added_at    TEXT NOT NULL,
  last_lookup TEXT NOT NULL
) WITHOUT ROWID;

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

-- v0.1 indexed did_room(last_ts). Nothing reads it, and since last_ts changes on every update
-- it doubled the rows written. Dropped on databases created before v0.2.
DROP INDEX IF EXISTS did_room_last_ts;
