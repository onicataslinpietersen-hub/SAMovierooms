import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, PageHead, Scroll, Stat, dt } from "@/components/admin/ui";
import { resolveAlert, runSyncNow } from "@/app/actions/admin";
import { dailyRevenue, financials, isoDay, openAlerts, orderCounts, parseRange, supplierPerformance } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { zar } from "@/lib/money";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const u = await requireStaff(["admin", "support"]);
  const sp = await searchParams;
  const range = parseRange(sp);
  const [fin, counts, alerts, perf, daily] = await Promise.all([financials(range), orderCounts(), openAlerts(), supplierPerformance(), dailyRevenue(range)]);
  const max = Math.max(1, ...daily.map((d) => Number(d.revenue)));
  const admin = u.role === "admin";
  return (
    <>
      <PageHead title="Overview" sub={`${range.label} · ${isoDay(range.from)} → ${isoDay(range.to)}`}>
        {[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]].map(([v, l]) => <Link key={v} href={`/admin?range=${v}`} className={`btn btn-sm border ${(sp.range ?? "30") === v ? "border-amber text-amber" : "border-white/12 text-sand"}`}>{l}</Link>)}
        {admin ? <ActionForm action={runSyncNow}><button className="btn-primary btn-sm">Run sync now</button></ActionForm> : null}
      </PageHead>
      {admin ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total revenue" value={zar(fin.revenue)} sub={`${fin.orders} paid orders`} />
          <Stat label="Gross profit" value={zar(fin.grossProfit)} sub={`${fin.marginPct.toFixed(1)}% margin after refunds`} tone={fin.grossProfit >= 0 ? "good" : "bad"} />
          <Stat label="Average order value" value={zar(fin.aov)} />
          <Stat label="Refunds" value={zar(fin.refunds)} sub={`${counts.refunded} orders fully refunded`} tone={fin.refunds ? "warn" : undefined} />
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending payment" value={String(counts.pending)} href="/admin/orders?status=pending_payment" />
        <Stat label="Awaiting fulfilment" value={String(counts.awaitingFulfilment)} href="/admin/orders?f=awaiting" tone={counts.awaitingFulfilment ? "warn" : undefined} />
        <Stat label="Shipped / in transit" value={String(counts.shipped)} sub={`${counts.delivered} delivered`} href="/admin/orders?f=shipped" />
        <Stat label="Failed" value={String(counts.failed)} sub={`${counts.failedFulfilment} fulfilment · ${counts.failed - counts.failedFulfilment} payment`} href="/admin/orders?f=failed" tone={counts.failed ? "bad" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {admin ? (
          <Card title="Revenue by day">
            {daily.length ? (
              <div className="flex h-44 items-end gap-1" role="img" aria-label="Daily revenue bar chart">
                {daily.map((d) => <div key={+d.day} className="group relative flex-1"><div className="rounded-t bg-gradient-to-t from-ember to-amber transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(3, (Number(d.revenue) / max) * 168)}px` }} /><span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-smoke px-2 py-1 text-[10px] group-hover:block">{d.day.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} · {zar(Number(d.revenue))}</span></div>)}
              </div>
            ) : <p className="text-sm text-ash">No paid orders in this period yet.</p>}
          </Card>
        ) : null}
        <Card title={`Needs attention (${alerts.length})`}>
          {alerts.length ? <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">{alerts.map((a) => (
            <li key={a.id} className={`rounded-xl border p-3 text-sm ${a.severity === "critical" ? "border-bad/40 bg-bad/[0.07]" : a.severity === "info" ? "border-white/10" : "border-amber/30 bg-amber/[0.05]"}`}>
              <p className="leading-relaxed">{a.message}</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ash"><span>{dt(a.created_at)}{a.number ? <> · <Link className="link" href={`/admin/orders/${a.order_id}`}>{a.number}</Link></> : null}</span><form action={resolveAlert}><input type="hidden" name="id" value={a.id} /><button className="text-ash underline-offset-4 hover:text-cream hover:underline">Mark resolved</button></form></div>
            </li>))}</ul> : <p className="text-sm text-ash">Nothing needs your attention. </p>}
        </Card>
      </div>

      <Card title="Supplier performance" className="mt-6">
        <Scroll>
          <table className="table-admin"><thead><tr><th>Supplier</th><th>Shipments</th><th>Delivered</th><th>In progress</th><th>Failed / cancelled</th><th>Avg. time to ship</th><th>Avg. time to deliver</th><th>Reliability</th></tr></thead>
            <tbody>{perf.map((s) => { const closed = s.delivered + s.failed; return (
              <tr key={s.id}><td><Link href={`/admin/suppliers/${s.id}`} className="font-medium hover:text-amber">{s.name}</Link></td><td>{s.total}</td><td>{s.delivered}</td><td>{s.in_flight}</td><td className={s.failed ? "text-bad" : ""}>{s.failed}</td><td>{s.avg_ship_hours ? `${s.avg_ship_hours} h` : "—"}</td><td>{s.avg_delivery_days ? `${s.avg_delivery_days} days` : "—"}</td><td>{closed ? `${Math.round((s.delivered / closed) * 100)}%` : "—"}</td></tr>); })}
              {!perf.length ? <tr><td colSpan={8} className="text-ash">No fulfilled orders yet.</td></tr> : null}</tbody></table>
        </Scroll>
      </Card>
    </>
  );
}
