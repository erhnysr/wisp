// Minimal D1-shaped wrapper over node:sqlite, enough for the indexer's queries.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { D1Like, D1Statement } from "../src/ingest";

export function makeDb(): D1Like & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const stmt = (sql: string, params: unknown[] = []): D1Statement => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    first: async <T>() => (raw.prepare(sql).get(...(params as never[])) as T) ?? null,
    all: async <T>() => ({ results: raw.prepare(sql).all(...(params as never[])) as T[] }),
    run: async () => raw.prepare(sql).run(...(params as never[])),
  });
  return {
    raw,
    prepare: (sql) => stmt(sql),
    batch: async (statements) => {
      raw.exec("BEGIN");
      try {
        for (const s of statements) await s.run();
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
