import { runSync } from "../src/lib/fulfillment";
import { pool } from "../src/lib/db";
runSync().then((r) => { console.log(JSON.stringify(r)); return pool().end(); }).catch((e) => { console.error(e); process.exit(1); });
