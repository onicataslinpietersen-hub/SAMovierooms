import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  if (process.argv.includes("--reset")) {
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  }
  const has = await pool.query("SELECT to_regclass('public.users') AS t");
  if (has.rows[0].t) console.log("Schema already present — nothing to do (use --reset to rebuild a dev database).");
  else {
    await pool.query(fs.readFileSync(path.join(process.cwd(), "db/schema.sql"), "utf8"));
    console.log("Schema created.");
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
