import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const built = JSON.parse(
  readFileSync(path.join(root, "dist/server/wrangler.json"), "utf8"),
);
const config = {
  name: "feedwise-ai",
  compatibility_date: built.compatibility_date,
  d1_databases: built.d1_databases.map((database) => ({
    ...database,
    migrations_dir: path.join(root, "drizzle"),
  })),
};
mkdirSync(path.join(root, ".sites-runtime"), { recursive: true });
const configPath = path.join(root, ".sites-runtime/local-migrations.json");
writeFileSync(configPath, JSON.stringify(config, null, 2));
const result = spawnSync(
  process.execPath,
  [
    "--import",
    path.join(root, "scripts/sites-env.mjs"),
    path.join(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    path.join(root, ".wrangler/state"),
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
