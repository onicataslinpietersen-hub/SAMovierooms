/**
 * End-to-end test of the order pipeline against the real database and the sandbox supplier:
 * checkout → payment confirmation → supplier submission → tracking → delivery, plus the failure paths.
 * Run with: npm run test:e2e   (requires DEMO_MODE=true and a seeded dev database)
 */
process.env.SANDBOX_STAGE_SECONDS = "1";
process.env.SUPPLIER_TIMEOUT_MS = "4000";
import assert from "node:assert/strict";
import { q, q1, pool } from "../src/lib/db";
import { createOrder, priceCart, quoteShipments } from "../src/lib/checkout";
import { applyPaymentResult } from "../src/lib/payments";
import { runSync } from "../src/lib/fulfillment";
import { cancelOrder } from "../src/lib/orders";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const RUN = Date.now().toString(36);
const ok = (name: string) => { passed++; console.log("  ✓ " + name); };

async function variantOf(name: string) {
  return (await q1<{ id: string }>("SELECT v.id FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.name=$1 ORDER BY v.sort LIMIT 1", [name]))!.id;
}

async function place(productName: string, line2 = "", optIndex = 0) {
  const lines = [{ variantId: await variantOf(productName), quantity: 1 }];
  const address = { recipient: "Thandi Test", phone: "0821234567", line1: "12 Test Street", line2, suburb: "Sandton", city: "Johannesburg", province: "GP", postalCode: "2196" };
  const cart = await priceCart(lines);
  const ships = await quoteShipments(lines, address);
  const shipping: Record<string, string> = {};
  let total = cart.subtotalCents - cart.discountCents;
  for (const s of ships) {
    const o = s.options[optIndex];
    shipping[String(s.supplierId)] = o.code;
    total += o.priceCents + (o.incoterm === "DDP" ? s.importEstimate.totalCents : 0);
  }
  const res = await createOrder({ email: "thandi@example.com", address, lines, shipping, discountCode: null, acceptTerms: true, expectedTotalCents: total }, null);
  assert.ok(res.ok, "order created: " + JSON.stringify(res));
  return { ...res, total, ships };
}
const fulfil = (orderId: string) => q1<{ id: string; status: string; supplier_order_ref: string | null; attempts: number; idempotency_key: string; tracking_number: string | null }>("SELECT * FROM fulfillments WHERE order_id=$1", [orderId]);
const supplierOrders = async (key: string) => Number((await q1<{ n: string }>("SELECT count(*) n FROM sandbox_supplier_orders WHERE idempotency_key=$1", [key]))!.n);
const due = (orderId: string) => q("UPDATE fulfillments SET next_attempt_at = now() WHERE order_id=$1", [orderId]);

async function main() {
  console.log("Order pipeline");
  // 1. Happy path
  const a = await place("Nocturne 1080p (4K input)");
  let f = (await fulfil(a.orderId))!;
  assert.equal(f.status, "pending");
  assert.equal(await supplierOrders(f.idempotency_key), 0);
  ok("unpaid order is not sent to the supplier");

  const cents = (await q1<{ amount_cents: number }>("SELECT amount_cents FROM payments WHERE id=$1", [a.paymentId]))!.amount_cents;
  assert.equal((await applyPaymentResult({ paymentId: a.paymentId, providerRef: `T1-${RUN}`, outcome: "succeeded", amountCents: cents - 100 })).ok, false);
  assert.equal((await fulfil(a.orderId))!.status, "pending");
  ok("payment with the wrong amount does not release the order");

  await applyPaymentResult({ paymentId: a.paymentId, providerRef: `T1-${RUN}`, outcome: "succeeded", amountCents: cents });
  f = (await fulfil(a.orderId))!;
  assert.equal(f.status, "submitted");
  assert.ok(f.supplier_order_ref?.startsWith("SBX-"));
  ok("confirmed payment submits the order and stores the supplier's reference");

  await Promise.all([1, 2, 3].map(() => applyPaymentResult({ paymentId: a.paymentId, providerRef: `T1-${RUN}`, outcome: "succeeded", amountCents: cents })));
  await runSync();
  assert.equal(await supplierOrders(f.idempotency_key), 1);
  ok("replayed payment notifications do not create duplicate supplier orders");

  const dup = await place("Ember Mini Pocket");
  assert.equal((await applyPaymentResult({ paymentId: dup.paymentId, providerRef: `T1-${RUN}`, outcome: "succeeded" })).ok, false);
  assert.equal((await fulfil(dup.orderId))!.status, "pending");
  ok("a gateway reference cannot be reused to pay a second order");

  // 2. Declined payment
  const b = await place("Ember Mini Pocket");
  await applyPaymentResult({ paymentId: b.paymentId, providerRef: `T2-${RUN}`, outcome: "failed" });
  assert.equal((await q1<{ status: string }>("SELECT status FROM orders WHERE id=$1", [b.orderId]))!.status, "payment_failed");
  assert.equal(await supplierOrders((await fulfil(b.orderId))!.idempotency_key), 0);
  ok("declined payment never reaches the supplier");

  // 3. Supplier rejects
  const c = await place("Ember Mini Pocket", "FAIL-SUPPLIER");
  await applyPaymentResult({ paymentId: c.paymentId, providerRef: `T3-${RUN}`, outcome: "succeeded" });
  f = (await fulfil(c.orderId))!;
  assert.equal(f.status, "failed");
  assert.equal(f.supplier_order_ref, null);
  assert.ok(await q1("SELECT 1 FROM alerts WHERE order_id=$1 AND kind='fulfilment_failed'", [c.orderId]));
  const pub = await q<{ kind: string }>("SELECT kind FROM order_events WHERE order_id=$1 AND NOT internal", [c.orderId]);
  assert.ok(!pub.some((e) => e.kind === "supplier_submitted"));
  ok("supplier rejection → failed + critical alert; customer timeline never claims submission");

  // 4. Timeout with ambiguous outcome → reconcile, no duplicate
  const d = await place("Ember Mini Pocket", "TIMEOUT-SUPPLIER");
  await applyPaymentResult({ paymentId: d.paymentId, providerRef: `T4-${RUN}`, outcome: "succeeded" });
  f = (await fulfil(d.orderId))!;
  assert.equal(f.status, "unknown");
  assert.equal(f.supplier_order_ref, null);
  await due(d.orderId);
  await runSync();
  f = (await fulfil(d.orderId))!;
  assert.equal(f.status === "submitted" || f.status === "confirmed", true, f.status);
  assert.equal(await supplierOrders(f.idempotency_key), 1);
  ok("supplier timeout → 'unknown', then reconciled by lookup without re-submitting");

  // 5. Transient failure → retry
  const e = await place("Ember Mini Pocket", "FLAKY-SUPPLIER");
  await applyPaymentResult({ paymentId: e.paymentId, providerRef: `T5-${RUN}`, outcome: "succeeded" });
  assert.equal((await fulfil(e.orderId))!.status, "failed");
  await due(e.orderId);
  await runSync();
  assert.ok(["submitted", "confirmed"].includes((await fulfil(e.orderId))!.status));
  ok("transient supplier error is retried with back-off and succeeds");

  // 6. Cancel before dispatch → supplier cancel + refund
  const g = await place("Zenith Universal Ceiling Mount");
  await applyPaymentResult({ paymentId: g.paymentId, providerRef: `T6-${RUN}`, outcome: "succeeded" });
  const cr = await cancelOrder(g.orderId, null, "customer changed mind");
  assert.ok(cr.ok, cr.message);
  const go = (await q1<{ status: string; refunded_cents: number; total_cents: number }>("SELECT status, refunded_cents, total_cents FROM orders WHERE id=$1", [g.orderId]))!;
  assert.equal(go.status, "refunded");
  assert.equal(go.refunded_cents, go.total_cents);
  ok("cancellation before dispatch cancels at the supplier and refunds in full");

  // 7. Tracking through to delivery
  for (let i = 0; i < 10; i++) { await sleep(1000); await runSync(); if ((await fulfil(a.orderId))!.status === "delivered") break; }
  f = (await fulfil(a.orderId))!;
  assert.equal(f.status, "delivered");
  assert.ok(f.tracking_number);
  assert.equal((await q1<{ status: string }>("SELECT status FROM orders WHERE id=$1", [a.orderId]))!.status, "delivered");
  const kinds = (await q<{ kind: string }>("SELECT kind FROM order_events WHERE order_id=$1 AND NOT internal ORDER BY id", [a.orderId])).map((x) => x.kind);
  for (const k of ["order_received", "payment_confirmed", "supplier_submitted", "shipped", "delivered"]) assert.ok(kinds.includes(k), "missing " + k);
  const mails = (await q<{ subject: string }>("SELECT subject FROM email_outbox WHERE to_email='thandi@example.com' AND subject LIKE $1", [`%${a.number}%`])).map((m) => m.subject);
  assert.ok(mails.some((s) => s.includes("confirmed")) && mails.some((s) => s.includes("shipped")) && mails.some((s) => s.includes("delivered")));
  ok("tracking syncs to delivered; customer notified at confirmation, dispatch and delivery");

  // 8. Shipped orders cannot be cancelled
  assert.equal((await cancelOrder(a.orderId, null, "too late")).ok, false);
  ok("delivered order cannot be cancelled");

  // 9. Tampered total
  const lines = [{ variantId: await variantOf("Lumière One 4K Laser"), quantity: 1 }];
  const t = await createOrder({ email: "x@example.com", address: { recipient: "A B", phone: "0821234567", line1: "1 Main Rd", city: "Cape Town", province: "WC", postalCode: "8001" }, lines, shipping: { [String(a.ships[0].supplierId)]: "express-ddp" }, acceptTerms: true, expectedTotalCents: 100 }, null);
  assert.equal(t.ok, false);
  ok("client-supplied totals are never trusted");

  console.log(`\n${passed} checks passed`);
}
main().then(() => pool().end()).catch((e) => { console.error("\nFAILED:", e); process.exit(1); });
