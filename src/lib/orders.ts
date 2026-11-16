import "server-only";
import { q, q1 } from "./db";
import { adapterFor, getSupplier, supplierContext } from "./suppliers";
import { alert, orderEvent } from "./fulfillment";
import { requestRefund } from "./payments";

export type OrderRow = {
  id: string; number: string; access_token: string; user_id: string | null; email: string; status: string;
  ship_recipient: string; ship_phone: string; ship_line1: string; ship_line2: string | null; ship_suburb: string | null; ship_city: string; ship_province: string; ship_postal_code: string;
  subtotal_cents: number; discount_cents: number; shipping_cents: number; duties_collected_cents: number; total_cents: number; discount_code: string | null;
  cost_cents: number; shipping_cost_cents: number; import_cost_cents: number; payment_fee_cents: number; refunded_cents: number;
  created_at: Date; paid_at: Date | null;
};
export type FulfillmentRow = {
  id: string; order_id: string; supplier_id: number; idempotency_key: string; status: string; supplier_order_ref: string | null; shipping_method: string; shipping_carrier: string | null; incoterm: "DDP" | "DAP";
  eta_min_days: number | null; eta_max_days: number | null; shipping_cents: number; shipping_cost_cents: number; duties_estimate_cents: number; tracking_number: string | null; tracking_url: string | null;
  attempts: number; last_error: string | null; next_attempt_at: Date | null; submitted_at: Date | null; shipped_at: Date | null; delivered_at: Date | null; created_at: Date;
};
export type ItemRow = { id: string; fulfillment_id: string | null; product_id: string | null; name: string; variant_name: string; sku: string; quantity: number; unit_price_cents: number; unit_cost_cents: number };

export async function getOrderBundle(where: { id?: string; number?: string }) {
  const order = where.id ? await q1<OrderRow>("SELECT * FROM orders WHERE id=$1", [where.id]) : await q1<OrderRow>("SELECT * FROM orders WHERE number=$1", [where.number]);
  if (!order) return null;
  const [items, fulfillments, events, tracking, payments, refunds] = await Promise.all([
    q<ItemRow & { kind: string | null; slug: string | null }>("SELECT i.*, p.kind, p.slug FROM order_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id=$1", [order.id]),
    q<FulfillmentRow & { supplier_name: string; adapter: string }>("SELECT f.*, s.name AS supplier_name, s.adapter FROM fulfillments f JOIN suppliers s ON s.id=f.supplier_id WHERE f.order_id=$1 ORDER BY f.created_at", [order.id]),
    q<{ kind: string; message: string; internal: boolean; created_at: Date }>("SELECT kind, message, internal, created_at FROM order_events WHERE order_id=$1 ORDER BY created_at, id", [order.id]),
    q<{ fulfillment_id: string; status: string; description: string; location: string | null; occurred_at: Date; source: string }>("SELECT t.* FROM tracking_events t JOIN fulfillments f ON f.id=t.fulfillment_id WHERE f.order_id=$1 ORDER BY t.occurred_at DESC", [order.id]),
    q<{ id: string; provider: string; provider_ref: string | null; status: string; amount_cents: number; fee_cents: number; created_at: Date }>("SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at", [order.id]),
    q<{ id: string; amount_cents: number; reason: string; status: string; created_at: Date }>("SELECT * FROM refunds WHERE order_id=$1 ORDER BY created_at", [order.id]),
  ]);
  return { order, items, fulfillments, events, tracking, payments, refunds };
}

/**
 * Cancels an order. Anything not yet with the supplier is cancelled immediately; anything already submitted is
 * cancelled through the supplier API where supported, otherwise flagged for a manual cancellation request.
 * Shipped parcels cannot be cancelled (returns process applies).
 */
export async function cancelOrder(orderId: string, actorId: string | null, reason: string): Promise<{ ok: boolean; message: string }> {
  const order = await q1<OrderRow>("SELECT * FROM orders WHERE id=$1", [orderId]);
  if (!order) return { ok: false, message: "Order not found." };
  if (["cancelled", "refunded", "delivered"].includes(order.status)) return { ok: false, message: `Order is already ${order.status}.` };
  if (order.status === "pending_payment" || order.status === "payment_failed") {
    await q("UPDATE orders SET status='cancelled' WHERE id=$1", [orderId]);
    await q("UPDATE fulfillments SET status='cancelled', updated_at=now() WHERE order_id=$1", [orderId]);
    await orderEvent(orderId, "cancelled", "Order cancelled");
    return { ok: true, message: "Unpaid order cancelled." };
  }
  const fs = await q<FulfillmentRow>("SELECT * FROM fulfillments WHERE order_id=$1", [orderId]);
  if (fs.some((f) => ["shipped", "in_transit", "out_for_delivery", "delivered"].includes(f.status))) return { ok: false, message: "Part of this order has already shipped. Use the returns process and refund instead." };
  if (fs.some((f) => f.status === "submitting" || f.status === "unknown")) return { ok: false, message: "A supplier submission is in progress or unresolved. Resolve it first, then cancel." };
  let pendingManual = false;
  for (const f of fs) {
    if (["pending", "failed", "awaiting_manual", "cancelled"].includes(f.status) && !f.supplier_order_ref) {
      await q("UPDATE fulfillments SET status='cancelled', next_attempt_at=NULL, updated_at=now() WHERE id=$1", [f.id]);
      continue;
    }
    const supplier = (await getSupplier(f.supplier_id))!;
    const adapter = adapterFor(supplier.adapter);
    let done = false, msg = "Supplier has no cancellation API.";
    if (adapter.cancelOrder && f.supplier_order_ref) {
      try {
        const r = await adapter.cancelOrder(await supplierContext(supplier), f.supplier_order_ref);
        done = r.cancelled; msg = r.message;
      } catch (e) { msg = (e as Error).message; }
    }
    if (done) await q("UPDATE fulfillments SET status='cancelled', updated_at=now() WHERE id=$1", [f.id]);
    else {
      pendingManual = true;
      await q("UPDATE fulfillments SET status='cancel_requested', updated_at=now() WHERE id=$1", [f.id]);
      await alert("cancel_manual", `Ask ${supplier.name} to cancel supplier order ${f.supplier_order_ref} (${f.idempotency_key}). ${msg}`, { orderId, supplierId: supplier.id, severity: "critical" });
    }
  }
  await orderEvent(orderId, "internal", `Cancellation requested: ${reason}`, true);
  if (pendingManual) return { ok: true, message: "Cancellation requested from the supplier. Refund once the supplier confirms." };
  await q("UPDATE orders SET status='cancelled' WHERE id=$1", [orderId]);
  await orderEvent(orderId, "cancelled", "Order cancelled");
  const refund = await requestRefund(orderId, order.total_cents - order.refunded_cents, `Order cancelled: ${reason}`, actorId);
  return { ok: true, message: `Order cancelled. ${refund.message}` };
}
