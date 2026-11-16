import Link from "next/link";
import { PageHead, Scroll, dt } from "@/components/admin/ui";
import { StatusChip } from "@/components/OrderList";
import { requireStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { zar } from "@/lib/money";

export const metadata = { title: "Orders" };
const F: Record<string, string> = {
  awaiting: "EXISTS (SELECT 1 FROM fulfillments f WHERE f.order_id=o.id AND f.status IN ('pending','submitting','awaiting_manual')) AND o.paid_at IS NOT NULL",
  shipped: "EXISTS (SELECT 1 FROM fulfillments f WHERE f.order_id=o.id AND f.status IN ('shipped','in_transit','out_for_delivery'))",
  failed: "(o.status='payment_failed' OR EXISTS (SELECT 1 FROM fulfillments f WHERE f.order_id=o.id AND f.status IN ('failed','unknown','cancel_requested') AND o.paid_at IS NOT NULL))",
};

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; f?: string; q?: string }> }) {
  const u = await requireStaff(["admin", "support"]);
  const sp = await searchParams;
  const where: string[] = [], params: unknown[] = [];
  if (sp.status) { params.push(sp.status); where.push(`o.status=$${params.length}`); }
  if (sp.f && F[sp.f]) where.push(F[sp.f]);
  if (sp.q) { params.push(`%${sp.q.toLowerCase()}%`); where.push(`(lower(o.number) LIKE $${params.length} OR lower(o.email) LIKE $${params.length} OR lower(o.ship_recipient) LIKE $${params.length})`); }
  const rows = await q<{ id: string; number: string; email: string; ship_recipient: string; ship_city: string; status: string; total_cents: number; created_at: Date; items: string; suppliers: string | null; fstatus: string | null; tracking: string | null; eta: string | null; pay: string | null; profit: number }>(
    `SELECT o.id, o.number, o.email, o.ship_recipient, o.ship_city, o.status, o.total_cents, o.created_at,
       (SELECT string_agg(i.quantity || ' × ' || i.name, ', ') FROM order_items i WHERE i.order_id=o.id) AS items,
       (SELECT string_agg(DISTINCT s.name, ', ') FROM fulfillments f JOIN suppliers s ON s.id=f.supplier_id WHERE f.order_id=o.id) AS suppliers,
       (SELECT string_agg(f.status, ', ') FROM fulfillments f WHERE f.order_id=o.id) AS fstatus,
       (SELECT string_agg(f.tracking_number, ', ') FROM fulfillments f WHERE f.order_id=o.id) AS tracking,
       (SELECT min(f.eta_min_days) || '–' || max(f.eta_max_days) || ' days' FROM fulfillments f WHERE f.order_id=o.id) AS eta,
       (SELECT p.status FROM payments p WHERE p.order_id=o.id ORDER BY p.created_at DESC LIMIT 1) AS pay,
       (o.total_cents - o.refunded_cents - o.cost_cents - o.shipping_cost_cents - o.import_cost_cents - o.payment_fee_cents) AS profit
     FROM orders o ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.created_at DESC LIMIT 200`, params);
  const tabs: [string, string][] = [["", "All"], ["?f=awaiting", "Awaiting fulfilment"], ["?f=shipped", "Shipped"], ["?f=failed", "Failed"], ["?status=pending_payment", "Pending payment"], ["?status=delivered", "Delivered"], ["?status=refunded", "Refunded"], ["?status=cancelled", "Cancelled"]];
  const cur = sp.f ? `?f=${sp.f}` : sp.status ? `?status=${sp.status}` : "";
  return (
    <>
      <PageHead title="Orders" sub="Every order with its payment, supplier, fulfilment state, tracking and delivery estimate." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([h, l]) => <Link key={l} href={`/admin/orders${h}`} className={`btn btn-sm border ${cur === h ? "border-amber text-amber" : "border-white/12 text-sand"}`}>{l}</Link>)}
        <form className="ml-auto flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Order no., email, name…" className="field !min-h-9 w-56" /><button className="btn-ghost btn-sm">Search</button></form>
      </div>
      <div className="panel p-5 sm:p-6"><Scroll>
        <table className="table-admin">
          <thead><tr><th>Order</th><th>Customer</th><th>Products</th><th>Payment</th><th>Supplier</th><th>Fulfilment</th><th>Tracking</th><th>Est. delivery</th><th className="text-right">Total</th>{u.role === "admin" ? <th className="text-right">Profit</th> : null}</tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-amber hover:underline">{o.number}</Link><span className="block text-xs text-dim">{dt(o.created_at)}</span><StatusChip status={o.status} /></td>
                <td className="min-w-40">{o.ship_recipient}<span className="block text-xs text-ash">{o.email}</span><span className="block text-xs text-dim">{o.ship_city}</span></td>
                <td className="min-w-48 max-w-64 text-xs text-sand">{o.items}</td>
                <td><StatusChip status={o.pay === "succeeded" ? "paid" : o.pay === "initiated" ? "pending_payment" : o.pay ?? "—"} /></td>
                <td className="text-xs text-sand">{o.suppliers ?? "—"}</td>
                <td className="text-xs">{o.fstatus?.split(", ").map((s, i) => <span key={i} className={`mr-1 inline-block ${["failed", "unknown", "cancel_requested"].includes(s) ? "font-semibold text-bad" : s === "awaiting_manual" ? "font-semibold text-amber" : "text-sand"}`}>{s.replace(/_/g, " ")}</span>) ?? "—"}</td>
                <td className="font-mono text-xs">{o.tracking ?? "—"}</td>
                <td className="whitespace-nowrap text-xs text-sand">{o.eta ?? "—"}</td>
                <td className="text-right tabular-nums">{zar(o.total_cents)}</td>
                {u.role === "admin" ? <td className={`text-right tabular-nums ${o.pay !== "succeeded" ? "text-dim" : o.profit < 0 ? "text-bad" : "text-ok"}`}>{o.pay === "succeeded" ? zar(o.profit) : "—"}</td> : null}
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={10} className="text-ash">No orders here yet.</td></tr> : null}
          </tbody>
        </table>
      </Scroll></div>
    </>
  );
}
