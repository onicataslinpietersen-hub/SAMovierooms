import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __pgPool?: Pool };

export function pool(): Pool {
  if (!g.__pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__pgPool = new Pool({ connectionString: url, max: 10 });
  }
  return g.__pgPool;
}

type Q = { query: Pool["query"] };

export async function q<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], client?: Q): Promise<T[]> {
  const res = await (client ?? pool()).query<T>(sql, params as never[]);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], client?: Q): Promise<T | null> {
  const rows = await q<T>(sql, params, client);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
