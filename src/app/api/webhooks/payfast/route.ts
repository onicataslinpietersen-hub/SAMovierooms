import { q, q1 } from "@/lib/db";
import { env } from "@/lib/env";
import { applyPaymentResult } from "@/lib/payments";
import { pfHost, pfItnSignature } from "@/lib/payments/payfast";
import { safeEqual } from "@/lib/crypto";

/**
 * PayFast ITN (instant transaction notification).
 * Checks, in order: signature → merchant id → amount (inside applyPaymentResult) → server-to-server confirmation
 * with PayFast → idempotency. Always answers 200 once the request is authenticated so PayFast stops retrying.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const pairs = body.split("&").filter(Boolean).map((kv) => { const i = kv.indexOf("="); return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "))] as [string, string]; });
  const data = Object.fromEntries(pairs);
  const eventKey = `${data.pf_payment_id}:${data.payment_status}`;
  const reject = async (note: string, status = 400) => {
    await q("INSERT INTO webhook_events(source, event_key, valid, payload, note) VALUES ('payfast',$1,false,$2::jsonb,$3) ON CONFLICT DO NOTHING", [`${eventKey}:${Date.now()}`, JSON.stringify(data), note]);
    return new Response(note, { status });
  };
  if (!data.signature || !safeEqual(pfItnSignature(pairs, env.payfast.passphrase), data.signature)) return reject("bad signature");
  if (data.merchant_id !== env.payfast.merchantId) return reject("merchant mismatch");
  // Ask PayFast to confirm the notification really came from them.
  try {
    const v = await fetch(`https://${pfHost(env.payfast.sandbox)}/eng/query/validate`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.split("&").filter((p) => !p.startsWith("signature=")).join("&"), signal: AbortSignal.timeout(15000) });
    if ((await v.text()).trim() !== "VALID") return reject("payfast did not validate");
  } catch {
    return reject("validation request failed", 503); // 5xx → PayFast retries later
  }
  const first = await q1("INSERT INTO webhook_events(source, event_key, valid, payload) VALUES ('payfast',$1,true,$2::jsonb) ON CONFLICT DO NOTHING RETURNING id", [eventKey, JSON.stringify(data)]);
  if (!first) return new Response("duplicate", { status: 200 });
  const outcome = data.payment_status === "COMPLETE" ? "succeeded" : data.payment_status === "CANCELLED" ? "cancelled" : data.payment_status === "FAILED" ? "failed" : null;
  if (outcome) {
    await applyPaymentResult({
      paymentId: data.m_payment_id, providerRef: data.pf_payment_id, outcome,
      amountCents: Math.round(Number(data.amount_gross) * 100),
      feeCents: data.amount_fee ? Math.abs(Math.round(Number(data.amount_fee) * 100)) : undefined,
      raw: data,
    });
  }
  return new Response("ok", { status: 200 });
}
