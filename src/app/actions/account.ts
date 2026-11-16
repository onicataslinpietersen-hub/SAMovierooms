"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, q1 } from "@/lib/db";
import { createSession, destroySession, getUser, hashPassword, passwordProblem, rateLimit, requireUser, verifyPassword } from "@/lib/auth";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { addressSchema, normalisePhone } from "@/lib/checkout";

type Result = { ok: boolean; message: string } | null;
const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
const safeNext = (n: FormDataEntryValue | null) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export async function register(_: Result, fd: FormData): Promise<Result> {
  const p = z.object({ firstName: z.string().trim().min(1, "Enter your first name").max(60), lastName: z.string().trim().min(1, "Enter your last name").max(60), email: z.string().trim().toLowerCase().email("Enter a valid email address"), password: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (fd.get("terms") !== "on") return { ok: false, message: "Please accept the terms and privacy policy to create an account." };
  const prob = passwordProblem(p.data.password);
  if (prob) return { ok: false, message: prob };
  if (!rateLimit("reg:" + (await ip()), 6, 15 * 60_000)) return { ok: false, message: "Too many attempts. Please try again later." };
  if (await q1("SELECT 1 FROM users WHERE email=$1", [p.data.email])) return { ok: false, message: "An account with this email already exists. Try signing in instead." };
  const u = (await q1<{ id: string }>("INSERT INTO users(email, password_hash, first_name, last_name, marketing_opt_in) VALUES ($1,$2,$3,$4,$5) RETURNING id", [p.data.email, await hashPassword(p.data.password), p.data.firstName, p.data.lastName, fd.get("marketing") === "on"]))!;
  // Attach earlier guest orders placed with the same email.
  await q("UPDATE orders SET user_id=$1 WHERE user_id IS NULL AND lower(email)=$2", [u.id, p.data.email]);
  await createSession(u.id);
  await sendEmail(p.data.email, "Welcome to SAMovierooms", `Hi ${p.data.firstName},\n\nYour SAMovierooms account is ready. You can track orders, save addresses and keep a wishlist at ${env.siteUrl}/account`);
  redirect(safeNext(fd.get("next")));
}

export async function login(_: Result, fd: FormData): Promise<Result> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase(), password = String(fd.get("password") ?? "");
  if (!rateLimit(`login:${await ip()}:${email}`, 8, 15 * 60_000)) return { ok: false, message: "Too many sign-in attempts. Please wait 15 minutes and try again." };
  const u = await q1<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email=$1", [email]);
  // Same message for unknown email and wrong password, so accounts cannot be enumerated.
  if (!u || !(await verifyPassword(password, u.password_hash))) return { ok: false, message: "Incorrect email or password." };
  await createSession(u.id);
  redirect(safeNext(fd.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function forgotPassword(_: Result, fd: FormData): Promise<Result> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const done = { ok: true, message: "If an account exists for that address, we have emailed a link to reset your password. The link is valid for 1 hour." };
  if (!rateLimit("forgot:" + (await ip()), 5, 15 * 60_000)) return done;
  const u = await q1<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]);
  if (u) {
    const token = randomToken();
    await q("INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES ($1,$2, now() + interval '1 hour')", [sha256(token), u.id]);
    await sendEmail(email, "Reset your SAMovierooms password", `We received a request to reset your password.\n\nReset it here (valid for 1 hour): ${env.siteUrl}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email.`);
  }
  return done;
}

export async function resetPassword(_: Result, fd: FormData): Promise<Result> {
  const token = String(fd.get("token") ?? ""), password = String(fd.get("password") ?? "");
  const prob = passwordProblem(password);
  if (prob) return { ok: false, message: prob };
  const r = await q1<{ user_id: string }>("UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() RETURNING user_id", [sha256(token)]);
  if (!r) return { ok: false, message: "This reset link is invalid or has expired. Please request a new one." };
  await q("UPDATE users SET password_hash=$2 WHERE id=$1", [r.user_id, await hashPassword(password)]);
  await q("DELETE FROM sessions WHERE user_id=$1", [r.user_id]); // sign out everywhere
  await createSession(r.user_id);
  redirect("/account");
}

export async function updateProfile(_: Result, fd: FormData): Promise<Result> {
  const u = await requireUser();
  const p = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), phone: z.string().trim().max(20).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Please check your details." };
  await q("UPDATE users SET first_name=$2, last_name=$3, phone=$4, marketing_opt_in=$5 WHERE id=$1", [u.id, p.data.firstName, p.data.lastName, p.data.phone || null, fd.get("marketing") === "on"]);
  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}

export async function saveAddress(_: Result, fd: FormData): Promise<Result> {
  const u = await requireUser();
  const p = addressSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const a = p.data, makeDefault = fd.get("isDefault") === "on" || !(await q1("SELECT 1 FROM addresses WHERE user_id=$1", [u.id]));
  if (makeDefault) await q("UPDATE addresses SET is_default=false WHERE user_id=$1", [u.id]);
  await q("INSERT INTO addresses(user_id, label, recipient, phone, line1, line2, suburb, city, province, postal_code, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [u.id, String(fd.get("label") || "Home").slice(0, 30), a.recipient, normalisePhone(a.phone), a.line1, a.line2 || null, a.suburb || null, a.city, a.province, a.postalCode, makeDefault]);
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddress(fd: FormData) {
  const u = await requireUser();
  await q("DELETE FROM addresses WHERE id=$1 AND user_id=$2", [fd.get("id"), u.id]);
  revalidatePath("/account/addresses");
}

export async function toggleWishlist(productId: string): Promise<{ ok: boolean; on?: boolean; login?: boolean }> {
  const u = await getUser();
  if (!u) return { ok: false, login: true };
  if (!z.string().uuid().safeParse(productId).success) return { ok: false };
  const del = await q("DELETE FROM wishlist_items WHERE user_id=$1 AND product_id=$2 RETURNING 1", [u.id, productId]);
  if (!del.length) await q("INSERT INTO wishlist_items(user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [u.id, productId]);
  revalidatePath("/account/wishlist");
  return { ok: true, on: !del.length };
}

export async function submitReview(_: Result, fd: FormData): Promise<Result> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Please sign in to write a review." };
  const p = z.object({ productId: z.string().uuid(), rating: z.coerce.number().int().min(1).max(5), title: z.string().trim().max(120), body: z.string().trim().min(10, "Please write at least a sentence about your experience.").max(3000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const bought = await q1("SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=$1 AND i.product_id=$2 AND o.status IN ('paid','processing','partially_shipped','shipped','delivered')", [u.id, p.data.productId]);
  await q(`INSERT INTO reviews(product_id, user_id, rating, title, body, verified_purchase) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (product_id, user_id) DO UPDATE SET rating=EXCLUDED.rating, title=EXCLUDED.title, body=EXCLUDED.body, status='pending', created_at=now()`, [p.data.productId, u.id, p.data.rating, p.data.title, p.data.body, !!bought]);
  return { ok: true, message: "Thank you! Your review will appear once it has been checked by our team." };
}
