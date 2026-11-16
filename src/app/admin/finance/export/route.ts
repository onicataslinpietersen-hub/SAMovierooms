import { financials, isoDay, parseRange } from "@/lib/admin-data";
import { getUser } from "@/lib/auth";
import { q } from "@/lib/db";

const r2 = (c: number) => (c / 100).toFixed(2);
// Quote every cell and neutralise spreadsheet formula injection from customer-entered text.
const cell = (v: unknown) => { let s = v === null || v === undefined ? "" : String(v); if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export async function GET(req: Request) {
  const u = await getUser();
  if (!u || u.role !== "admin") return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const range = parseRange(sp);
  let body: string, name: string;
  if (sp.type === "summary") {
    const f = await financials(range);
    name = "summary";
    body = csv([["SAMovierooms financial summary", `${isoDay(range.from)} to ${isoDay(range.to)}`], [], ["Metric", "ZAR"], ["Paid orders", f.orders], ["Sales revenue", r2(f.revenue)], ["Refunds", r2(-f.refunds)], ["Supplier costs", r2(-f.supplierCosts)], ["Shipping expenses", r2(-f.shippingCosts)], ["Import costs paid (DDP)", r2(-f.importCosts)], ["Payment fees", r2(-f.paymentFees)], ["Gross profit", r2(f.grossProfit)], ["Average order value", r2(f.aov)]]);
  } else {
    const rows = await q<Record<string, never>>(
      `SELECT o.number, o.paid_at, o.status, o.email, o.ship_city, o.ship_province,
         (SELECT string_agg(i.quantity || ' x ' || i.name, '; ') FROM order_items i WHERE i.order_id=o.id) AS items,
         (SELECT string_agg(DISTINCT s.name, '; ') FROM fulfillments f JOIN suppliers s ON s.id=f.supplier_id WHERE f.order_id=o.id) AS suppliers,
         o.subtotal_cents, o.discount_cents, o.shipping_cents, o.duties_collected_cents, o.total_cents, o.refunded_cents, o.cost_cents, o.shipping_cost_cents, o.import_cost_cents, o.payment_fee_cents
       FROM orders o WHERE o.paid_at BETWEEN $1 AND $2 ORDER BY o.paid_at`, [range.from, range.to]);
    name = "orders";
    body = csv([
      ["Order", "Paid at", "Status", "Customer email", "City", "Province", "Items", "Supplier", "Subtotal", "Discount", "Shipping charged", "Duties collected", "Total", "Refunded", "Supplier cost", "Shipping cost", "Import cost", "Payment fee", "Gross profit"],
      ...rows.map((o) => { const dead = ["cancelled", "refunded"].includes(o.status); const c = dead ? 0 : o.cost_cents, s = dead ? 0 : o.shipping_cost_cents, i = dead ? 0 : o.import_cost_cents;
        return [o.number, (o.paid_at as Date).toISOString(), o.status, o.email, o.ship_city, o.ship_province, o.items, o.suppliers, r2(o.subtotal_cents), r2(o.discount_cents), r2(o.shipping_cents), r2(o.duties_collected_cents), r2(o.total_cents), r2(o.refunded_cents), r2(c), r2(s), r2(i), r2(o.payment_fee_cents), r2(o.total_cents - o.refunded_cents - c - s - i - o.payment_fee_cents)]; }),
    ]);
  }
  return new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="samovierooms-${name}-${isoDay(range.from)}_${isoDay(range.to)}.csv"`, "Cache-Control": "no-store" } });
}
