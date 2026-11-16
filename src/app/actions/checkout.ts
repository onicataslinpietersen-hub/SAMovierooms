"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, rateLimit } from "@/lib/auth";
import { createOrder } from "@/lib/checkout";
import { q1 } from "@/lib/db";
import { env } from "@/lib/env";
import { applyPaymentResult, sandboxPayToken, startPayment, type StartPayment } from "@/lib/payments";
import { safeEqual } from "@/lib/crypto";

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export async function placeOrder(payload: unknown): Promise<{ ok: false; error: string } | { ok: true; number: string; payment: StartPayment }> {
  if (!rateLimit("order:" + (await ip()), 10, 10 * 60_000)) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  const user = await getUser();
  const res = await createOrder(payload, user?.id ?? null);
  if (!res.ok) return res;
  try {
    return { ok: true, number: res.number, payment: await startPayment(res.paymentId) };
  } catch (e) {
    console.error("startPayment failed", e);
    return { ok: false, error: "Your order was saved but we could not start the payment. Please try again from your order page, or contact us." };
  }
}

/** Retry payment for an unpaid order (new payment attempt, same order). */
export async function retryPayment(fd: FormData) {
  const number = String(fd.get("number")), token = String(fd.get("token"));
  const o = await q1<{ id: string; access_token: string; total_cents: number }>("SELECT id, access_token, total_cents FROM orders WHERE number=$1 AND status IN ('pending_payment','payment_failed')", [number]);
  if (!o || !safeEqual(o.access_token, token)) redirect("/track");
  const p = (await q1<{ id: string }>("INSERT INTO payments(order_id, provider, amount_cents) VALUES ($1,$2,$3) RETURNING id", [o.id, env.paymentProvider, o.total_cents]))!;
  const start = await startPayment(p.id);
  if (start.kind === "redirect") redirect(start.url);
  redirect(`/checkout/pay/${p.id}?t=${token}`);
}

/** Sandbox gateway only: the simulated "bank" result. Disabled outside DEMO_MODE. */
export async function sandboxPay(fd: FormData) {
  if (!env.demoMode) throw new Error("Sandbox payments are disabled");
  const id = String(fd.get("id")), k = String(fd.get("k")), outcome = String(fd.get("outcome")) as "succeeded" | "failed" | "cancelled";
  if (!safeEqual(sandboxPayToken(id), k) || !["succeeded", "failed", "cancelled"].includes(outcome)) throw new Error("Invalid sandbox payment request");
  const row = await q1<{ number: string; access_token: string; amount_cents: number }>("SELECT o.number, o.access_token, p.amount_cents FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1", [id]);
  if (!row) throw new Error("Unknown payment");
  await applyPaymentResult({ paymentId: id, providerRef: "SBXPAY-" + id.slice(0, 8), outcome, amountCents: row.amount_cents, raw: { sandbox: true } });
  redirect(`/order/${row.number}?t=${row.access_token}`);
}

export async function trackOrder(_: { message: string } | null, fd: FormData): Promise<{ message: string } | null> {
  if (!rateLimit("track:" + (await ip()), 10, 10 * 60_000)) return { message: "Too many attempts. Please try again later." };
  const number = String(fd.get("number") ?? "").trim().toUpperCase(), email = String(fd.get("email") ?? "").trim().toLowerCase();
  const o = await q1<{ number: string; access_token: string }>("SELECT number, access_token FROM orders WHERE upper(number)=$1 AND lower(email)=$2", [number.startsWith("SAM-") ? number : `SAM-${number}`, email]);
  if (!o) return { message: "We could not find an order with that number and email address. Please check both and try again." };
  redirect(`/order/${o.number}?t=${o.access_token}`);
}
