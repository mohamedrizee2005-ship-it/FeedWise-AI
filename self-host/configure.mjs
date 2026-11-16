// Converts a verified build to a config for the reader's own Cloudflare account.
// The configured database is a NEW database; managed Site data is never copied.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const settingsPath = path.join(root, "self-host/settings.json");
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(settings.worker_name || ""))
  throw new Error("Set a lowercase worker_name in self-host/settings.json.");
if (
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(
    settings.database_id || "",
  ) ||
  settings.database_id === "00000000-0000-4000-8000-000000000000"
)
  throw new Error(
    "Create your own D1 database and paste its database_id in self-host/settings.json.",
  );
const built = JSON.parse(
  readFileSync(path.join(root, "dist/server/wrangler.json"), "utf8"),
);
const config = {
  ...built,
  name: settings.worker_name,
  workers_dev: true,
  d1_databases: [
    {
      binding: "DB",
      database_name: settings.database_name,
      database_id: settings.database_id,
      migrations_dir: "../../drizzle",
    },
  ],
  observability: { enabled: false },
};
delete config.topLevelName;
const output = path.join(root, "dist/server/wrangler.selfhost.json");
writeFileSync(output, JSON.stringify(config, null, 2) + "\n");
console.log(
  "Prepared dist/server/wrangler.selfhost.json. No deployment or billing change was made.",
);
