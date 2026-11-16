import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

const key = () => crypto.createHash("sha256").update("cred:" + env.appSecret).digest();

/** AES-256-GCM; used for supplier API credentials at rest. */
export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  try {
    const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const hmac = (s: string) => crypto.createHmac("sha256", env.appSecret).update(s).digest("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
