import "./sites-env.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildConfig = path.join(root, "dist/server/wrangler.json");
let config;
try { config = JSON.parse(readFileSync(buildConfig, "utf8")); }
catch { console.error("Build belum tersedia. Jalankan pnpm build terlebih dahulu."); process.exit(1); }
const binding = config.d1_databases?.find(item => item.binding === "DB");
if (!binding) { console.error("Binding D1 DB tidak ditemukan pada hasil build."); process.exit(1); }
const runtime = path.join(root, ".sites-runtime");
mkdirSync(runtime, { recursive: true });
const localConfig = path.join(runtime, "migrations.wrangler.json");
writeFileSync(localConfig, JSON.stringify({
  name: config.name,
  compatibility_date: config.compatibility_date,
  compatibility_flags: config.compatibility_flags,
  d1_databases: [{ ...binding, migrations_dir: path.join(root, "drizzle") }],
}, null, 2));

// Wrangler records applied SQL migrations; subsequent runs do not replay them.
// This command always uses the local database, never a production database.
const result = spawnSync(process.execPath, [
  path.join(root, "node_modules/wrangler/bin/wrangler.js"),
  "d1", "migrations", "apply", "DB", "--local", "--config", localConfig,
  "--persist-to", path.join(root, ".wrangler/state"),
], { cwd: root, stdio: "inherit", env: { ...process.env, CI: "1" } });
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
