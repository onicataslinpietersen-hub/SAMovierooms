import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { q, q1 } from "./db";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "samr_session";
const DAYS = 30;

export type User = { id: string; email: string; first_name: string; last_name: string; phone: string | null; role: "customer" | "support" | "admin" };

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
  return null;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + DAYS * 864e5);
  await q("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [sha256(token), userId, expires]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return q1<User>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
});

export async function requireUser(next = "/account"): Promise<User> {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Role-based access control. Every admin page AND every admin server action calls this. */
export async function requireStaff(roles: User["role"][] = ["admin"]): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login?next=/admin");
  if (!roles.includes(u.role)) redirect("/");
  return u;
}

// Small in-memory limiter for credential endpoints. Swap for Redis when running more than one instance.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}

export async function audit(actorId: string | null, action: string, detail: unknown = {}) {
  await q("INSERT INTO audit_log(actor_id, action, detail) VALUES ($1,$2,$3::jsonb)", [actorId, action, JSON.stringify(detail)]);
}
