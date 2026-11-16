import "server-only";
import { q, q1 } from "./db";
import { adapterFor, getSupplier, supplierContext } from "./suppliers";
import { SupplierError, withTimeout } from "./suppliers/types";
import { sendEmail, orderUrl } from "./email";
import { loadProducts } from "./catalog";
import { profit } from "./pricing";
import { getSettings } from "./settings";

/**
 * Supplier-independent fulfilment engine.
 *
 * Invariants:
 *  - A supplier is only contacted for orders whose payment is confirmed.
 *  - One fulfilment row per (order, supplier), enforced by a UNIQUE idempotency key; that key is also sent to the
 *    supplier as our order number. A row is "claimed" with an atomic UPDATE before any network call, so two workers
 *    can never submit the same fulfilment at once.
 *  - status becomes 'submitted' only when the supplier returned an order reference (or an admin recorded one).
 *    A timeout is recorded as 'unknown' and reconciled with findOrder() before any re-submission.
 */
const MAX_ATTEMPTS = 5;
const SUBMIT_TIMEOUT_MS = Number(process.env.SUPPLIER_TIMEOUT_MS || 25000);
const backoffMinutes = (attempt: number) => Math.min(60, 2 ** attempt);

type F = { id: string; order_id: string; supplier_id: number; idempotency_key: string; status: string; supplier_order_ref: string | null; shipping_method: string; attempts: number; tracking_number: string | null };

export async function alert(kind: string, message: string, o: { orderId?: string; supplierId?: number; severity?: "info" | "warning" | "critical" } = {}) {
  await q("INSERT INTO alerts(kind, message, order_id, supplier_id, severity) VALUES ($1,$2,$3,$4,$5)", [kind, message, o.orderId ?? null, o.supplierId ?? null, o.severity ?? "warning"]);
}

export async function orderEvent(orderId: string, kind: string, message: string, internal = false) {
  await q("INSERT INTO order_events(order_id, kind, message, internal) VALUES ($1,$2,$3,$4)", [orderId, kind, message, internal]);
}

async function markSubmitted(f: F, ref: string, how: string) {
  await q("UPDATE fulfillments SET status='submitted', supplier_order_ref=$2, submitted_at=now(), last_error=NULL, next_attempt_at=NULL, updated_at=now() WHERE id=$1", [f.id, ref]);
  await q("UPDATE orders SET status='processing' WHERE id=$1 AND status='paid'", [f.order_id]);
  await orderEvent(f.order_id, "supplier_submitted", "Order sent to our fulfilment partner");
  await orderEvent(f.order_id, "internal", `Supplier order ${ref} (${how})`, true);
}

export async function processFulfillment(id: string): Promise<string> {
  // Atomic claim. Only paid orders; only rows that are due.
  const f = await q1<F & { prev: string }>(
    `UPDATE fulfillments f SET status='submitting', attempts = f.attempts + 1, updated_at = now()
     FROM (SELECT id, status AS prev FROM fulfillments WHERE id = $1 FOR UPDATE) old, orders o
     WHERE f.id = old.id AND o.id = f.order_id AND o.status IN ('paid','processing','partially_shipped')
       AND old.prev IN ('pending','failed','unknown') AND (f.next_attempt_at IS NULL OR f.next_attempt_at <= now() OR old.prev = 'pending')
     RETURNING f.*, old.prev`, [id]);
  if (!f) return "skipped";
  const supplier = (await getSupplier(f.supplier_id))!;
  const adapter = adapterFor(supplier.adapter);
  const ctx = await supplierContext(supplier);

  if (!adapter.capabilities.orders || !adapter.submitOrder || supplier.status !== "approved") {
    await q("UPDATE fulfillments SET status='awaiting_manual', updated_at=now() WHERE id=$1", [f.id]);
    await alert("manual_fulfilment", `Order needs manual fulfilment with ${supplier.name}.`, { orderId: f.order_id, supplierId: supplier.id, severity: "info" });
    return "awaiting_manual";
  }

  try {
    // Duplicate prevention: if a previous attempt may have reached the supplier, look for it before sending again.
    if ((f.prev === "unknown" || f.attempts > 1) && adapter.findOrder) {
      const existing = await withTimeout(adapter.findOrder(ctx, f.idempotency_key), SUBMIT_TIMEOUT_MS, "Supplier order lookup");
      if (existing) {
        await markSubmitted(f, existing.supplierOrderRef, "found by reconciliation — not re-submitted");
        return "submitted";
      }
    } else if (f.prev === "unknown") {
      throw new SupplierError("Outcome of the previous attempt is unknown and this supplier cannot be queried — check with the supplier, then record the order manually.", { retryable: false });
    }
    const order = (await q1<Record<string, string>>("SELECT * FROM orders WHERE id=$1", [f.order_id]))!;
    const items = await q<{ supplier_ref: string; sku: string; name: string; quantity: number }>("SELECT supplier_ref, sku, name, quantity FROM order_items WHERE fulfillment_id=$1", [f.id]);
    const res = await withTimeout(adapter.submitOrder(ctx, {
      idempotencyKey: f.idempotency_key,
      shippingCode: f.shipping_method,
      destination: { recipient: order.ship_recipient, phone: order.ship_phone, line1: order.ship_line1, line2: order.ship_line2, suburb: order.ship_suburb, city: order.ship_city, province: order.ship_province, postalCode: order.ship_postal_code, country: order.ship_country, email: order.email },
      items: items.map((i) => ({ ref: i.supplier_ref, sku: i.sku, name: i.name, quantity: i.quantity })),
    }), SUBMIT_TIMEOUT_MS, "Supplier order submission");
    if (!res?.supplierOrderRef) throw new SupplierError("Supplier returned no order reference", { retryable: true, ambiguous: true });
    await markSubmitted(f, res.supplierOrderRef, "confirmed by supplier API");
    return "submitted";
  } catch (e) {
    const err = e instanceof SupplierError ? e : new SupplierError((e as Error).message, { retryable: true, ambiguous: true });
    const exhausted = f.attempts >= MAX_ATTEMPTS;
    if (err.opts.ambiguous) {
      await q("UPDATE fulfillments SET status='unknown', last_error=$2, next_attempt_at = CASE WHEN $3 THEN NULL ELSE now() + interval '2 minutes' END, updated_at=now() WHERE id=$1", [f.id, err.message, exhausted]);
      await alert("fulfilment_unknown", `Supplier did not answer in time for ${f.idempotency_key}. The order will be reconciled before any retry. ${err.message}`, { orderId: f.order_id, supplierId: supplier.id, severity: exhausted ? "critical" : "warning" });
      return "unknown";
    }
    const retry = err.opts.retryable && !exhausted;
    await q(`UPDATE fulfillments SET status='failed', last_error=$2, next_attempt_at = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE NULL END, updated_at=now() WHERE id=$1`, [f.id, err.message, retry, String(backoffMinutes(f.attempts))]);
    await orderEvent(f.order_id, "internal", `Fulfilment attempt ${f.attempts} failed: ${err.message}`, true);
    if (!retry) await alert("fulfilment_failed", `Fulfilment FAILED for ${f.idempotency_key} with ${supplier.name}: ${err.message}. Needs attention.`, { orderId: f.order_id, supplierId: supplier.id, severity: "critical" });
    return "failed";
  }
}

const RANK: Record<string, number> = { submitted: 1, confirmed: 2, shipped: 3, in_transit: 4, out_for_delivery: 5, delivered: 6 };

export async function recomputeOrderStatus(orderId: string) {
  const fs = await q<{ status: string }>("SELECT status FROM fulfillments WHERE order_id=$1 AND status <> 'cancelled'", [orderId]);
  if (!fs.length) return;
  const shippedPlus = fs.filter((f) => (RANK[f.status] ?? 0) >= 3).length;
  const delivered = fs.filter((f) => f.status === "delivered").length;
  const next = delivered === fs.length ? "delivered" : shippedPlus === fs.length ? "shipped" : shippedPlus > 0 ? "partially_shipped" : null;
  if (next) await q("UPDATE orders SET status=$2 WHERE id=$1 AND status IN ('paid','processing','partially_shipped','shipped')", [orderId, next]);
}

/** Applies a supplier/carrier status to a fulfilment. Status only moves forward; events are de-duplicated. */
export async function applyStatus(fid: string, st: { status: string; trackingNumber?: string; carrier?: string; trackingUrl?: string; events: { status: string; description: string; location?: string; occurredAt: Date }[] }, source: "supplier" | "carrier" | "admin") {
  const f = (await q1<F>("SELECT * FROM fulfillments WHERE id=$1", [fid]))!;
  const order = (await q1<{ id: string; number: string; access_token: string; email: string }>("SELECT id, number, access_token, email FROM orders WHERE id=$1", [f.order_id]))!;
  for (const e of st.events) {
    await q("INSERT INTO tracking_events(fulfillment_id, status, description, location, occurred_at, source) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", [fid, e.status, e.description, e.location ?? null, e.occurredAt, source]);
  }
  if (st.status === "cancelled") {
    if (f.status !== "cancelled") {
      await q("UPDATE fulfillments SET status='cancelled', updated_at=now() WHERE id=$1", [fid]);
      await alert("supplier_cancelled", `Supplier cancelled ${f.idempotency_key}. Refund or re-source the items.`, { orderId: f.order_id, supplierId: f.supplier_id, severity: "critical" });
    }
    return;
  }
  const from = RANK[f.status] ?? 0, to = RANK[st.status] ?? 0;
  if (st.trackingNumber && st.trackingNumber !== f.tracking_number) {
    await q("UPDATE fulfillments SET tracking_number=$2, shipping_carrier=COALESCE($3, shipping_carrier), tracking_url=COALESCE($4, tracking_url), updated_at=now() WHERE id=$1", [fid, st.trackingNumber, st.carrier ?? null, st.trackingUrl ?? null]);
  }
  if (to <= from) return;
  await q(`UPDATE fulfillments SET status=$2, shipped_at = CASE WHEN $3 AND shipped_at IS NULL THEN now() ELSE shipped_at END, delivered_at = CASE WHEN $2='delivered' THEN now() ELSE delivered_at END, updated_at=now() WHERE id=$1`, [fid, st.status, to >= 3]);
  const msgs: Record<string, [string, string]> = {
    confirmed: ["supplier_confirmed", "Fulfilment partner confirmed your order and is preparing it"],
    shipped: ["shipped", `Shipped${st.trackingNumber ? ` — tracking number ${st.trackingNumber}` : ""}`],
    in_transit: ["in_transit", "In transit"],
    out_for_delivery: ["out_for_delivery", "Out for delivery"],
    delivered: ["delivered", "Delivered"],
  };
  // Record each milestone we passed, but never invent intermediate ones the carrier did not report.
  const [kind, message] = msgs[st.status] ?? ["info", st.status];
  await orderEvent(order.id, kind, message);
  if (from < 3 && to >= 3) {
    await sendEmail(order.email, `Your SAMovierooms order ${order.number} has shipped`, `Good news — your order is on its way.\n\n${st.carrier ? `Carrier: ${st.carrier}\n` : ""}${st.trackingNumber ? `Tracking number: ${st.trackingNumber}\n` : ""}\nTrack your order: ${orderUrl(order)}\n\nDelivery dates are estimates and may change during customs clearance.`);
  }
  if (st.status === "out_for_delivery") await sendEmail(order.email, `Your SAMovierooms order ${order.number} is out for delivery`, `Your parcel is out for delivery today.\n\nTrack: ${orderUrl(order)}`);
  if (st.status === "delivered") await sendEmail(order.email, `Your SAMovierooms order ${order.number} was delivered`, `Your order has been delivered. Enjoy the show!\n\nIf anything is not right, reply to this email or open a support request: ${orderUrl(order)}`);
  await recomputeOrderStatus(order.id);
}

export async function syncFulfillment(id: string): Promise<void> {
  const f = await q1<F>("SELECT * FROM fulfillments WHERE id=$1 AND supplier_order_ref IS NOT NULL AND status IN ('submitted','confirmed','shipped','in_transit','out_for_delivery','cancel_requested')", [id]);
  if (!f) return;
  const supplier = (await getSupplier(f.supplier_id))!;
  const adapter = adapterFor(supplier.adapter);
  if (!adapter.getOrderStatus) return;
  try {
    const st = await withTimeout(adapter.getOrderStatus(await supplierContext(supplier), f.supplier_order_ref!), 20000, "Tracking sync");
    await applyStatus(f.id, st, "supplier");
  } catch (e) {
    await q("UPDATE fulfillments SET last_error=$2, updated_at=now() WHERE id=$1", [f.id, "Tracking sync: " + (e as Error).message]);
  }
}

/** Pulls current cost + stock for every mapped product of a supplier, then enforces the minimum-margin rule. */
export async function syncSupplierOffers(supplierId: number): Promise<{ updated: number; unpublished: string[] }> {
  const supplier = (await getSupplier(supplierId))!;
  const adapter = adapterFor(supplier.adapter);
  if (!adapter.getOffers) return { updated: 0, unpublished: [] };
  const rows = await q<{ id: string; supplier_ref: string; cost_cents: number; stock: number }>("SELECT id, supplier_ref, cost_cents, stock FROM supplier_products WHERE supplier_id=$1", [supplierId]);
  const offers = await adapter.getOffers(await supplierContext(supplier), rows.map((r) => r.supplier_ref));
  let updated = 0;
  for (const r of rows) {
    const o = offers.find((x) => x.ref === r.supplier_ref);
    if (!o) continue;
    const cost = o.costCents ?? r.cost_cents, stock = o.stock ?? r.stock;
    if (cost !== r.cost_cents || stock !== r.stock) updated++;
    await q("UPDATE supplier_products SET cost_cents=$2, stock=$3, source_currency=$4, source_amount=$5, last_synced_at=now() WHERE id=$1", [r.id, cost, stock, o.sourceCurrency, o.sourceAmount]);
  }
  return { updated, unpublished: await enforceMargins() };
}

/** Unpublishes any published product whose cheapest variant has fallen below the minimum margin. */
export async function enforceMargins(): Promise<string[]> {
  const settings = await getSettings();
  const out: string[] = [];
  for (const p of await loadProducts("all")) {
    if (p.status !== "published") continue;
    const bad = p.variants.find((v) => v.offer && profit({ retailCents: v.priceCents, costCents: v.offer.costCents }, settings).marginBps < settings.min_margin_bps);
    if (bad) {
      await q("UPDATE products SET status='unpublished', updated_at=now() WHERE id=$1", [p.id]);
      await alert("margin_breach", `${p.name} was unpublished automatically: margin on "${bad.name}" fell below the minimum after a supplier price change.`, { severity: "critical" });
      out.push(p.name);
    }
  }
  return out;
}

/** Background worker tick. Safe to call concurrently and repeatedly (cron, admin button, after payment). */
export async function runSync(): Promise<Record<string, number>> {
  // Rows stuck in 'submitting' (process died mid-call) have an unknown outcome.
  const stuck = await q("UPDATE fulfillments SET status='unknown', last_error='Worker stopped mid-submission', next_attempt_at=now() WHERE status='submitting' AND updated_at < now() - interval '5 minutes' RETURNING id");
  const due = await q<{ id: string }>(
    `SELECT f.id FROM fulfillments f JOIN orders o ON o.id=f.order_id
     WHERE o.status IN ('paid','processing','partially_shipped') AND (f.status='pending' OR (f.status IN ('failed','unknown') AND f.next_attempt_at <= now())) LIMIT 50`);
  let submitted = 0;
  for (const d of due) if ((await processFulfillment(d.id)) === "submitted") submitted++;
  const track = await q<{ id: string }>("SELECT id FROM fulfillments WHERE supplier_order_ref IS NOT NULL AND status IN ('submitted','confirmed','shipped','in_transit','out_for_delivery','cancel_requested') ORDER BY updated_at LIMIT 200");
  for (const t of track) await syncFulfillment(t.id);
  // Supplier timeout: accepted the order but has not confirmed it within 72 hours.
  const silent = await q<{ id: string; order_id: string; supplier_id: number; idempotency_key: string }>(
    `SELECT f.id, f.order_id, f.supplier_id, f.idempotency_key FROM fulfillments f
     WHERE f.status='submitted' AND f.submitted_at < now() - interval '72 hours'
       AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.order_id=f.order_id AND a.kind='supplier_silent' AND a.resolved_at IS NULL)`);
  for (const s of silent) await alert("supplier_silent", `Supplier has not confirmed ${s.idempotency_key} after 72 hours.`, { orderId: s.order_id, supplierId: s.supplier_id });
  const suppliers = await q<{ id: number }>("SELECT id FROM suppliers WHERE status='approved'");
  let offers = 0;
  for (const s of suppliers) {
    try { offers += (await syncSupplierOffers(s.id)).updated; } catch (e) { await alert("sync_failed", `Price/stock sync failed for supplier #${s.id}: ${(e as Error).message}`, { supplierId: s.id }); }
  }
  // Abandoned unpaid orders are cancelled after 24h so they stop cluttering the dashboard.
  await q("UPDATE orders SET status='cancelled' WHERE status='pending_payment' AND created_at < now() - interval '24 hours'");
  return { stuck: stuck.length, attempted: due.length, submitted, tracked: track.length, offersUpdated: offers };
}
