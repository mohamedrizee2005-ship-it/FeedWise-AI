import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { textKey } from "../shared/analysis.mjs";

const migrations = new URL("../database/migrations/", import.meta.url);

export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  try {
    sqlite.function("feedwise_text_key", { deterministic: true }, textKey);
    sqlite.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    const files = readdirSync(migrations)
      .filter((name) => /^\d+_.+\.sql$/u.test(name))
      .sort();
    const applied = sqlite
      .prepare("SELECT name,sha256 FROM schema_migrations")
      .all();
    if (applied.some((row) => !files.includes(row.name)))
      throw new Error(
        "This database belongs to a newer project version. Restore the matching source before opening it.",
      );
    for (const name of files) {
      const sql = readFileSync(new URL(name, migrations), "utf8");
      const sha256 = createHash("sha256").update(sql).digest("hex");
      const existing = applied.find((row) => row.name === name);
      if (existing) {
        if (existing.sha256 !== sha256)
          throw new Error(
            `Applied database migration was changed: ${name}. Restore the original migration file.`,
          );
        continue;
      }
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        sqlite.exec(sql);
        if (sqlite.prepare("PRAGMA foreign_key_check").all().length)
          throw new Error("Database migration would break a relationship.");
        sqlite
          .prepare("INSERT INTO schema_migrations(name,sha256) VALUES(?,?)")
          .run(name, sha256);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
    return {
      sqlite,
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        return {
          bind(...args) {
            return {
              first: async () => statement.get(...args) ?? null,
              all: async () => ({ results: statement.all(...args) }),
              run: async () => statement.run(...args),
              _statement: statement,
              _args: args,
            };
          },
        };
      },
      async batch(statements) {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const result = statements.map((item) =>
            item._statement.run(...item._args),
          );
          sqlite.exec("COMMIT");
          return result;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
      close: () => sqlite.close(),
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
