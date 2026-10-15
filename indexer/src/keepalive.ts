/**
 * Keeps the operator's own identity notes from being reclaimed.
 *
 * technocore-chat deletes a note nobody has written for 7 days, which is how the identity notes
 * published in August were gone by October. Notes are also world-writable, so reading a note back
 * and rewriting its current bytes would just as happily keep a stranger's overwrite alive.
 * Instead this re-asserts a configured value at each listed path: `KEEPALIVE_NOTES` is a JSON
 * object of `"/kv/<ns>/<key>": "<value>"`, normally the operator's DID profile and contribution
 * notes. Unset, the feature is off.
 */

import type { D1Like } from "./ingest";

export interface KeepaliveResult {
  path: string;
  ok: boolean;
  status: number;
  error?: string;
}

// technocore-chat's name rule, for both the namespace and the key.
const NAME = "[a-z0-9][a-z0-9_-]{0,47}";
const PATH_RE = new RegExp(`^/kv/${NAME}/${NAME}$`);
const MAX_NOTE_CHARS = 8192; // technocore-chat's note cap
const MAX_NOTES = 10;
// Notes are stored single-line: these would be rewritten as spaces, so the value we assert
// would never equal the value read back.
const CONTROL_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\u2028\u2029]/u;

/** Parses and validates `KEEPALIVE_NOTES`. Throws on a malformed config so the logs say why. */
export function parseKeepalive(value: string | undefined): Array<[string, string]> {
  if (!value || !value.trim()) return [];
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("KEEPALIVE_NOTES must be a JSON object of path -> value");
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > MAX_NOTES) throw new Error(`KEEPALIVE_NOTES lists more than ${MAX_NOTES} notes`);
  return entries.map(([path, note]) => {
    if (!PATH_RE.test(path)) throw new Error(`not a /kv/<ns>/<key> path: ${path}`);
    if (typeof note !== "string" || !note.trim()) throw new Error(`empty value for ${path}`);
    if ([...note].length > MAX_NOTE_CHARS) throw new Error(`value for ${path} exceeds ${MAX_NOTE_CHARS} chars`);
    if (CONTROL_RE.test(note)) throw new Error(`value for ${path} must be a single line`);
    return [path, note];
  });
}

export async function keepNotesAlive(
  notes: Array<[string, string]>,
  deps: { fetch: typeof fetch; base: string },
): Promise<KeepaliveResult[]> {
  const results: KeepaliveResult[] = [];
  for (const [path, note] of notes) {
    try {
      const res = await deps.fetch(`${deps.base}${path}/set/${encodeURIComponent(note)}`, {
        headers: { accept: "text/plain" },
      });
      results.push({ path, ok: res.ok, status: res.status });
    } catch (err) {
      results.push({ path, ok: false, status: 0, error: String(err) });
    }
  }
  return results;
}

/** Four passes a day: the 7-day window survives days of missed cron runs. */
export function isKeepaliveMinute(now: Date): boolean {
  return now.getUTCHours() % 6 === 0 && now.getUTCMinutes() === 41;
}

// Created on first use so an existing database needs no migration step; schema.sql has the same.
const CREATE_STATUS = `CREATE TABLE IF NOT EXISTS keepalive_status (
  path            TEXT PRIMARY KEY,
  ok              INTEGER NOT NULL,
  status          INTEGER NOT NULL,
  error           TEXT,
  last_attempt_at TEXT NOT NULL,
  last_success_at TEXT
) WITHOUT ROWID`;

const UPSERT_STATUS = `INSERT INTO keepalive_status (path, ok, status, error, last_attempt_at, last_success_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (path) DO UPDATE SET
    ok              = excluded.ok,
    status          = excluded.status,
    error           = excluded.error,
    last_attempt_at = excluded.last_attempt_at,
    last_success_at = COALESCE(excluded.last_success_at, keepalive_status.last_success_at)`;

/** Remember each pass's outcome, so /health can show the keep-alive is actually running. */
export async function recordKeepalive(db: D1Like, results: KeepaliveResult[], now: Date): Promise<void> {
  if (results.length === 0) return;
  const at = now.toISOString();
  await db.prepare(CREATE_STATUS).run();
  await db.batch(
    results.map((r) =>
      db.prepare(UPSERT_STATUS).bind(r.path, r.ok ? 1 : 0, r.status, r.error ?? null, at, r.ok ? at : null),
    ),
  );
}

export interface KeepaliveStatus {
  path: string;
  ok: boolean;
  status: number;
  error: string | null;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
}

interface StatusRow {
  path: string;
  ok: number;
  status: number;
  error: string | null;
  last_attempt_at: string;
  last_success_at: string | null;
}

/** The last recorded outcome per note; empty until the first pass (or when the table is absent). */
export async function readKeepalive(db: D1Like): Promise<KeepaliveStatus[]> {
  try {
    const rows = await db.prepare("SELECT * FROM keepalive_status ORDER BY path").all<StatusRow>();
    return rows.results.map((r) => ({
      path: r.path,
      ok: r.ok === 1,
      status: r.status,
      error: r.error,
      lastAttemptAt: r.last_attempt_at,
      lastSuccessAt: r.last_success_at,
    }));
  } catch {
    return [];
  }
}
