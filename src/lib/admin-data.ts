import "server-only";
import { q, q1 } from "./db";
import type { InternalProduct } from "./catalog";
import { profit } from "./pricing";
import type { Settings } from "./settings";
import { resolutionClass } from "./specs";

export type Range = { from: Date; to: Date; label: string };

export function parseRange(sp: { from?: string; to?: string; range?: string }): Range {
  const now = new Date();
  const end = sp.to ? new Date(sp.to + "T23:59:59") : now;
  const days = sp.range === "7" ? 7 : sp.range === "90" ? 90 : sp.range === "365" ? 365 : 30;
  const start = sp.from ? new Date(sp.from + "T00:00:00") : new Date(end.getTime() - days * 864e5);
  return { from: start, to: end, label: sp.from || sp.to ? "Custom range" : `Last ${days} days` };
}
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Financials for paid orders in a date range (by payment date).
 * For cancelled/refunded orders the supplier was never paid (cancellation only succeeds before dispatch),
 * so their supplier, shipping and import costs are counted as zero; gateway fees are still counted.
 */
const FIN_SQL = `
  SELECT
    count(*)::int AS orders,
    COALESCE(sum(total_cents),0)::bigint AS revenue,
    COALESCE(sum(refunded_cents),0)::bigint AS refunds,
    COALESCE(sum(CASE WHEN status IN ('cancelled','refunded') THEN 0 ELSE cost_cents END),0)::bigint AS supplier_costs,
    COALESCE(sum(CASE WHEN status IN ('cancelled','refunded') THEN 0 ELSE shipping_cost_cents END),0)::bigint AS shipping_costs,
    COALESCE(sum(CASE WHEN status IN ('cancelled','refunded') THEN 0 ELSE import_cost_cents END),0)::bigint AS import_costs,
    COALESCE(sum(payment_fee_cents),0)::bigint AS payment_fees
  FROM orders WHERE paid_at IS NOT NULL AND paid_at BETWEEN $1 AND $2`;

export type Financials = { orders: number; revenue: number; refunds: number; supplierCosts: number; shippingCosts: number; importCosts: number; paymentFees: number; grossProfit: number; aov: number; marginPct: number };

export async function financials(r: Range): Promise<Financials> {
  const x = (await q1<Record<string, string>>(FIN_SQL, [r.from, r.to]))!;
  const n = (k: string) => Number(x[k]);
  const net = n("revenue") - n("refunds");
  const gp = net - n("supplier_costs") - n("shipping_costs") - n("import_costs") - n("payment_fees");
  return { orders: n("orders"), revenue: n("revenue"), refunds: n("refunds"), supplierCosts: n("supplier_costs"), shippingCosts: n("shipping_costs"), importCosts: n("import_costs"), paymentFees: n("payment_fees"), grossProfit: gp, aov: n("orders") ? Math.round(n("revenue") / n("orders")) : 0, marginPct: net > 0 ? (gp / net) * 100 : 0 };
}

export const dailyRevenue = (r: Range) =>
  q<{ day: Date; revenue: string; orders: number }>("SELECT date_trunc('day', paid_at) AS day, sum(total_cents) AS revenue, count(*)::int AS orders FROM orders WHERE paid_at IS NOT NULL AND paid_at BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1", [r.from, r.to]);

export const orderCounts = async () => {
  const rows = await q<{ status: string; n: number }>("SELECT status, count(*)::int AS n FROM orders GROUP BY status");
  const f = await q<{ status: string; n: number }>("SELECT f.status, count(*)::int AS n FROM fulfillments f JOIN orders o ON o.id=f.order_id WHERE o.paid_at IS NOT NULL GROUP BY f.status");
  const get = (rs: { status: string; n: number }[], ...s: string[]) => rs.filter((x) => s.includes(x.status)).reduce((a, x) => a + x.n, 0);
  return {
    pending: get(rows, "pending_payment"),
    awaitingFulfilment: get(f, "pending", "submitting", "awaiting_manual"),
    shipped: get(f, "shipped", "in_transit", "out_for_delivery"),
    delivered: get(f, "delivered"),
    failed: get(f, "failed", "unknown") + get(rows, "payment_failed"),
    failedFulfilment: get(f, "failed", "unknown"),
    refunded: get(rows, "refunded"),
  };
};

export const supplierPerformance = () =>
  q<{ id: number; name: string; total: number; delivered: number; failed: number; in_flight: number; avg_ship_hours: string | null; avg_delivery_days: string | null }>(
    `SELECT s.id, s.name, count(f.id)::int AS total,
       count(*) FILTER (WHERE f.status='delivered')::int AS delivered,
       count(*) FILTER (WHERE f.status IN ('failed','unknown','cancelled'))::int AS failed,
       count(*) FILTER (WHERE f.status IN ('pending','submitting','awaiting_manual','submitted','confirmed','shipped','in_transit','out_for_delivery'))::int AS in_flight,
       avg(EXTRACT(EPOCH FROM (f.shipped_at - f.submitted_at))/3600)::numeric(10,1) AS avg_ship_hours,
       avg(EXTRACT(EPOCH FROM (f.delivered_at - f.submitted_at))/86400)::numeric(10,1) AS avg_delivery_days
     FROM suppliers s JOIN fulfillments f ON f.supplier_id=s.id JOIN orders o ON o.id=f.order_id AND o.paid_at IS NOT NULL GROUP BY s.id, s.name ORDER BY total DESC`);

/** Everything that must be true before a product may be shown to customers. */
export function publishBlockers(p: InternalProduct, s: Settings): string[] {
  const out: string[] = [];
  const offers = p.variants.filter((v) => v.offer);
  if (!offers.length) out.push("No offer from an approved supplier.");
  if (!p.specsVerified) out.push("Specifications have not been verified against the supplier datasheet / a tested sample.");
  const isDisplay = p.kind.startsWith("projector") || p.kind === "tv";
  if (isDisplay && resolutionClass(p.specs) === "unknown") out.push("Native resolution is missing — required for projectors and televisions.");
  if (p.kind.startsWith("projector") && p.specs.brightness_value && !p.specs.brightness_unit) out.push("Brightness needs a unit (ANSI or ISO lumens).");
  if (!p.weightG || !p.lengthMm || !p.widthMm || !p.heightMm) out.push("Shipping weight and packed dimensions are required for delivery quotes.");
  if (!p.description.trim()) out.push("Description is empty.");
  for (const v of offers) {
    if (v.priceCents <= 0) { out.push(`No price for "${v.name}" — add a markup rule or an individual price.`); continue; }
    const m = profit({ retailCents: v.priceCents, costCents: v.offer!.costCents }, s);
    if (m.grossProfitCents <= 0) out.push(`"${v.name}" would sell at a loss (${(m.marginBps / 100).toFixed(1)}% margin).`);
    else if (m.marginBps < s.min_margin_bps) out.push(`"${v.name}" margin ${(m.marginBps / 100).toFixed(1)}% is below the minimum ${(s.min_margin_bps / 100).toFixed(0)}%.`);
  }
  return out;
}

export const openAlerts = (limit = 20) =>
  q<{ id: string; severity: string; kind: string; message: string; order_id: string | null; number: string | null; created_at: Date }>(
    "SELECT a.id, a.severity, a.kind, a.message, a.order_id, o.number, a.created_at FROM alerts a LEFT JOIN orders o ON o.id=a.order_id WHERE a.resolved_at IS NULL ORDER BY (a.severity='critical') DESC, a.created_at DESC LIMIT $1", [limit]);
