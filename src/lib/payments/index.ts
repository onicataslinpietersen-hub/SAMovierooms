import "server-only";
import { q, q1 } from "../db";
import { env } from "../env";
import { hmac } from "../crypto";
import { sendEmail, orderUrl } from "../email";
import { orderEvent, processFulfillment, alert } from "../fulfillment";
import { zar } from "../money";
import { pfCheckoutFields, pfHost } from "./payfast";

export type StartPayment = { kind: "redirect"; url: string } | { kind: "form"; action: string; fields: [string, string][] };

export const sandboxPayToken = (paymentId: string) => hmac("sandbox-pay:" + paymentId).slice(0, 32);

export async function startPayment(paymentId: string): Promise<StartPayment> {
  const p = (await q1<{ id: string; provider: string; amount_cents: number; number: string; access_token: string; email: string; ship_recipient: string }>(
    "SELECT p.id, p.provider, p.amount_cents, o.number, o.access_token, o.email, o.ship_recipient FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1", [paymentId]))!;
  if (p.provider === "payfast") {
    if (!env.payfast.merchantId || !env.payfast.merchantKey) throw new Error("PayFast credentials are not configured");
    const [first, ...rest] = p.ship_recipient.split(" ");
    return {
      kind: "form",
      action: `https://${pfHost(env.payfast.sandbox)}/eng/process`,
      fields: pfCheckoutFields({ merchantId: env.payfast.merchantId, merchantKey: env.payfast.merchantKey, passphrase: env.payfast.passphrase, siteUrl: env.siteUrl, paymentId: p.id, orderNumber: p.number, accessToken: p.access_token, amountCents: p.amount_cents, email: p.email, firstName: first, lastName: rest.join(" ") }),
    };
  }
  if (p.provider === "sandbox") {
    if (!env.demoMode) throw new Error("Sandbox payments are disabled outside DEMO_MODE");
    return { kind: "redirect", url: `/checkout/sandbox-pay/${p.id}?k=${sandboxPayToken(p.id)}` };
  }
  throw new Error(`Unknown payment provider ${p.provider}`);
}

/**
 * The single place where a payment outcome is applied. Called by gateway webhooks (after validation) and by the
 * sandbox gateway. Idempotent: replays and out-of-order notifications cannot pay an order twice or trigger a
 * second supplier submission.
 */
export async function applyPaymentResult(r: { paymentId: string; providerRef: string; outcome: "succeeded" | "failed" | "cancelled"; amountCents?: number; feeCents?: number; raw?: unknown }): Promise<{ ok: boolean; note: string }> {
  const pay = await q1<{ id: string; order_id: string; status: string; amount_cents: number }>("SELECT id, order_id, status, amount_cents FROM payments WHERE id=$1", [r.paymentId]);
  if (!pay) return { ok: false, note: "unknown payment" };
  if (pay.status === "succeeded") return { ok: true, note: "already succeeded (replay ignored)" };
  if (r.outcome === "succeeded" && r.amountCents !== undefined && r.amountCents !== pay.amount_cents) {
    await alert("payment_mismatch", `Gateway reported ${zar(r.amountCents)} for a payment of ${zar(pay.amount_cents)} (payment ${pay.id}). Order NOT released.`, { orderId: pay.order_id, severity: "critical" });
    return { ok: false, note: "amount mismatch" };
  }
  if (r.outcome !== "succeeded") {
    await q("UPDATE payments SET status=$2, provider_ref=COALESCE(provider_ref,$3), raw=$4::jsonb, updated_at=now() WHERE id=$1 AND status='initiated'", [pay.id, r.outcome, r.providerRef, JSON.stringify(r.raw ?? {})]);
    const changed = await q1<{ id: string }>("UPDATE orders SET status='payment_failed' WHERE id=$1 AND status='pending_payment' RETURNING id", [pay.order_id]);
    if (changed) await orderEvent(pay.order_id, "payment_failed", r.outcome === "cancelled" ? "Payment was cancelled" : "Payment was declined");
    return { ok: true, note: r.outcome };
  }
  // Compare-and-set: only one caller wins.
  let won: { id: string } | null;
  try {
    won = await q1<{ id: string }>("UPDATE payments SET status='succeeded', provider_ref=$2, fee_cents=COALESCE($3, fee_cents), raw=$4::jsonb, updated_at=now() WHERE id=$1 AND status <> 'succeeded' RETURNING id", [pay.id, r.providerRef, r.feeCents ?? null, JSON.stringify(r.raw ?? {})]);
  } catch (e) {
    // One gateway transaction can settle only one payment (unique index on provider + provider_ref).
    if ((e as { code?: string }).code !== "23505") throw e;
    await alert("payment_ref_reused", `Gateway reference ${r.providerRef} was already used for another payment. Payment ${pay.id} NOT accepted.`, { orderId: pay.order_id, severity: "critical" });
    return { ok: false, note: "gateway reference already used" };
  }
  if (!won) return { ok: true, note: "already succeeded (race)" };
  const order = await q1<{ id: string; number: string; access_token: string; email: string; total_cents: number; discount_code: string | null }>(
    "UPDATE orders SET status='paid', paid_at=now(), payment_fee_cents=COALESCE($2, payment_fee_cents) WHERE id=$1 AND status IN ('pending_payment','payment_failed') RETURNING id, number, access_token, email, total_cents, discount_code", [pay.order_id, r.feeCents ?? null]);
  if (!order) {
    await alert("payment_orphan", `Payment ${pay.id} succeeded but its order was not awaiting payment (cancelled?). Refund may be required.`, { orderId: pay.order_id, severity: "critical" });
    return { ok: true, note: "order not awaiting payment" };
  }
  if (order.discount_code) await q("UPDATE discounts SET used = used + 1 WHERE code=$1", [order.discount_code]);
  await orderEvent(order.id, "payment_confirmed", "Payment confirmed");
  await sendEmail(order.email, `Order ${order.number} confirmed — SAMovierooms`, `Thank you for your order.\n\nOrder number: ${order.number}\nTotal paid: ${zar(order.total_cents, { decimals: true })}\n\nYour order is fulfilled and shipped directly by our supplier partner. We will email you a tracking number as soon as it ships.\n\nView or track your order: ${orderUrl(order)}`);
  // Only now — after confirmed payment — may the supplier be contacted. Failures are retried by the worker.
  const fs = await q<{ id: string }>("SELECT id FROM fulfillments WHERE order_id=$1 AND status='pending'", [order.id]);
  for (const f of fs) {
    try { await processFulfillment(f.id); } catch (e) { console.error("fulfilment kick-off failed", e); }
  }
  return { ok: true, note: "paid" };
}

/** Refunds. The sandbox gateway refunds instantly; for PayFast the refund is recorded as requested and an admin
 *  completes it in the PayFast dashboard, then marks it processed (PayFast's refund API is not wired up yet). */
export async function requestRefund(orderId: string, amountCents: number, reason: string, actorId: string | null): Promise<{ ok: boolean; message: string }> {
  const order = await q1<{ id: string; number: string; email: string; total_cents: number; refunded_cents: number; status: string }>("SELECT id, number, email, total_cents, refunded_cents, status FROM orders WHERE id=$1", [orderId]);
  const pay = await q1<{ id: string; provider: string }>("SELECT id, provider FROM payments WHERE order_id=$1 AND status='succeeded' ORDER BY created_at DESC LIMIT 1", [orderId]);
  if (!order || !pay) return { ok: false, message: "No successful payment to refund." };
  if (amountCents <= 0 || amountCents > order.total_cents - order.refunded_cents) return { ok: false, message: "Refund amount exceeds what is refundable." };
  const auto = pay.provider === "sandbox";
  const ref = await q1<{ id: string }>("INSERT INTO refunds(order_id, payment_id, amount_cents, reason, status, created_by, processed_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [orderId, pay.id, amountCents, reason, auto ? "processed" : "requested", actorId, auto ? new Date() : null]);
  if (auto) await finaliseRefund(ref!.id);
  return { ok: true, message: auto ? "Refund processed (sandbox gateway)." : "Refund recorded. Process it in the payment gateway dashboard, then mark it as processed here." };
}

export async function finaliseRefund(refundId: string) {
  const r = await q1<{ order_id: string; amount_cents: number }>("UPDATE refunds SET status='processed', processed_at=COALESCE(processed_at, now()) WHERE id=$1 RETURNING order_id, amount_cents", [refundId]);
  if (!r) return;
  const o = (await q1<{ id: string; number: string; email: string; total_cents: number; refunded_cents: number }>("UPDATE orders SET refunded_cents = LEAST(total_cents, (SELECT COALESCE(sum(amount_cents),0) FROM refunds WHERE order_id=$1 AND status='processed')) WHERE id=$1 RETURNING id, number, email, total_cents, refunded_cents", [r.order_id]))!;
  if (o.refunded_cents >= o.total_cents) await q("UPDATE orders SET status='refunded' WHERE id=$1", [o.id]);
  await orderEvent(o.id, "refunded", `Refund of ${zar(r.amount_cents, { decimals: true })} processed`);
  await sendEmail(o.email, `Refund for order ${o.number}`, `We have refunded ${zar(r.amount_cents, { decimals: true })} to your original payment method. Depending on your bank it can take a few business days to reflect.`);
}
