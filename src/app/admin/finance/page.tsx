import Link from "next/link";
import { Card, PageHead, Scroll, Stat } from "@/components/admin/ui";
import { financials, isoDay, parseRange } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { zar } from "@/lib/money";

export const metadata = { title: "Finance" };

function Row({ l, v, neg, strong }: { l: string; v: number; neg?: boolean; strong?: boolean }) { return <div className={`flex justify-between py-2 ${strong ? "border-t border-white/10 text-base font-semibold" : "text-sm"}`}><dt className={strong ? "" : "text-sand"}>{l}</dt><dd className={`tabular-nums ${strong ? (v < 0 ? "text-bad" : "text-ok") : ""}`}>{neg && v ? "−" : ""}{zar(Math.abs(v), { decimals: true })}{v < 0 && !neg ? "" : ""}</dd></div>; }

export default async function Finance({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = parseRange(sp);
  const [fin, bySupplier, byCategory] = await Promise.all([
    financials(range),
    q<{ name: string; units: number; revenue: string; cost: string }>(`SELECT s.name, sum(i.quantity)::int AS units, sum(i.quantity*i.unit_price_cents) AS revenue, sum(i.quantity*i.unit_cost_cents) AS cost FROM order_items i JOIN orders o ON o.id=i.order_id JOIN suppliers s ON s.id=i.supplier_id WHERE o.paid_at BETWEEN $1 AND $2 AND o.status NOT IN ('cancelled','refunded') GROUP BY s.name ORDER BY revenue DESC`, [range.from, range.to]),
    q<{ name: string; units: number; revenue: string; cost: string }>(`SELECT COALESCE(pc.name, c.name) AS name, sum(i.quantity)::int AS units, sum(i.quantity*i.unit_price_cents) AS revenue, sum(i.quantity*i.unit_cost_cents) AS cost FROM order_items i JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id JOIN categories c ON c.id=p.category_id LEFT JOIN categories pc ON pc.id=c.parent_id WHERE o.paid_at BETWEEN $1 AND $2 AND o.status NOT IN ('cancelled','refunded') GROUP BY 1 ORDER BY revenue DESC`, [range.from, range.to]),
  ]);
  const qs = `from=${isoDay(range.from)}&to=${isoDay(range.to)}`;
  return (
    <>
      <PageHead title="Finance" sub={`${range.label}: ${isoDay(range.from)} → ${isoDay(range.to)} (by payment date)`}>
        <a href={`/admin/finance/export?${qs}&type=summary`} className="btn-ghost btn-sm">Download summary (CSV)</a>
        <a href={`/admin/finance/export?${qs}&type=orders`} className="btn-primary btn-sm">Download orders (CSV)</a>
      </PageHead>
      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <div><label className="label" htmlFor="from">From</label><input id="from" type="date" name="from" defaultValue={isoDay(range.from)} className="field" /></div>
          <div><label className="label" htmlFor="to">To</label><input id="to" type="date" name="to" defaultValue={isoDay(range.to)} className="field" /></div>
          <button className="btn-primary">Apply</button>
          {[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]].map(([v, l]) => <Link key={v} href={`/admin/finance?range=${v}`} className="btn-ghost btn-sm">{l}</Link>)}
        </form>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales revenue" value={zar(fin.revenue)} sub={`${fin.orders} paid orders`} />
        <Stat label="Gross profit" value={zar(fin.grossProfit)} sub={`${fin.marginPct.toFixed(1)}% of net revenue`} tone={fin.grossProfit >= 0 ? "good" : "bad"} />
        <Stat label="Supplier costs" value={zar(fin.supplierCosts)} />
        <Stat label="Refunds" value={zar(fin.refunds)} tone={fin.refunds ? "warn" : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Profit & loss">
          <dl>
            <Row l="Sales revenue (incl. delivery & prepaid duties)" v={fin.revenue} />
            <Row l="Refunds" v={fin.refunds} neg />
            <Row l="Supplier costs" v={fin.supplierCosts} neg />
            <Row l="Shipping expenses" v={fin.shippingCosts} neg />
            <Row l="Import duties & VAT paid by the business (DDP)" v={fin.importCosts} neg />
            <Row l="Payment fees" v={fin.paymentFees} neg />
            <Row l="Gross profit" v={fin.grossProfit} strong />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-dim">Management figures, not statutory accounts. Payment fees are the gateway-reported fee where available, otherwise your estimate. Excludes advertising, salaries, income tax and output VAT — confirm your VAT position with an accountant.</p>
        </Card>
        {([["By supplier", bySupplier], ["By category", byCategory]] as const).map(([title, rows]) => (
          <Card key={title} title={title}><Scroll><table className="table-admin"><thead><tr><th>{title.slice(3)}</th><th className="text-right">Units</th><th className="text-right">Sales</th><th className="text-right">Cost</th><th className="text-right">Margin</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td className="text-right">{r.units}</td><td className="text-right tabular-nums">{zar(Number(r.revenue))}</td><td className="text-right tabular-nums">{zar(Number(r.cost))}</td><td className="text-right tabular-nums">{Number(r.revenue) ? `${(((Number(r.revenue) - Number(r.cost)) / Number(r.revenue)) * 100).toFixed(1)}%` : "—"}</td></tr>)}{!rows.length ? <tr><td colSpan={5} className="text-ash">No sales in this period.</td></tr> : null}</tbody></table></Scroll></Card>
        ))}
      </div>
    </>
  );
}
