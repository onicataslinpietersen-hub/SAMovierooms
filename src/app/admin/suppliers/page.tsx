import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, Field, PageHead, Scroll } from "@/components/admin/ui";
import { addSupplier } from "@/app/actions/admin";
import { supplierPerformance } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { zar } from "@/lib/money";
import { ADAPTERS, adapterFor, listSuppliers } from "@/lib/suppliers";

export const metadata = { title: "Suppliers" };
const Cap = ({ on, label }: { on: boolean; label: string }) => <span className={`mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] ${on ? "bg-ok/15 text-ok" : "bg-white/5 text-dim line-through"}`}>{label}</span>;

export default async function Suppliers() {
  await requireStaff();
  const [suppliers, perf, stats] = await Promise.all([
    listSuppliers(), supplierPerformance(),
    q<{ supplier_id: number; products: number; min_cost: number | null; max_cost: number | null; in_stock: number }>("SELECT supplier_id, count(*)::int AS products, min(cost_cents) AS min_cost, max(cost_cents) AS max_cost, count(*) FILTER (WHERE stock > 0)::int AS in_stock FROM supplier_products GROUP BY supplier_id"),
  ]);
  return (
    <>
      <PageHead title="Suppliers" sub="Compare suppliers before you rely on them. Only approved suppliers can sell through the store; everything else is research." />
      <Card title="Supplier comparison">
        <Scroll>
          <table className="table-admin min-w-[1500px]">
            <thead><tr><th>Supplier</th><th>Verification</th><th>Products</th><th>Wholesale range</th><th>Min. order</th><th>Ships to SA</th><th>Shipping methods</th><th>Est. delivery</th><th>Warranty</th><th>API</th><th>Dropshipping</th><th>Fulfilment reliability</th></tr></thead>
            <tbody>
              {suppliers.map((s) => {
                const st = stats.find((x) => x.supplier_id === s.id), pf = perf.find((x) => x.id === s.id), cap = adapterFor(s.adapter).capabilities;
                const closed = pf ? pf.delivered + pf.failed : 0;
                return (
                  <tr key={s.id}>
                    <td className="min-w-48"><Link href={`/admin/suppliers/${s.id}`} className="font-semibold text-amber hover:underline">{s.name}</Link><span className="block text-xs text-dim">priority {s.priority}{s.is_sample ? " · simulated" : ""}</span></td>
                    <td className="min-w-52"><span className={`chip ${s.status === "approved" ? "border-ok/40 bg-ok/10 text-ok" : s.status === "suspended" ? "border-bad/40 bg-bad/10 text-bad" : "border-amber/40 bg-amber/10 text-amber"}`}>{s.status === "approved" ? "Approved" : s.status === "pending_verification" ? "Not yet verified" : s.status === "research" ? "Research only" : "Suspended"}</span><span className="mt-1 line-clamp-3 block text-xs text-ash">{s.verification_notes}</span></td>
                    <td>{st ? <>{st.products}<span className="block text-xs text-dim">{st.in_stock} in stock</span></> : "0"}</td>
                    <td className="whitespace-nowrap tabular-nums">{st?.min_cost != null ? `${zar(st.min_cost)} – ${zar(st.max_cost!)}` : "—"}</td>
                    <td className="min-w-32 text-xs">{s.moq_notes || "—"}</td>
                    <td><span className={s.ships_to_za === "yes" ? "text-ok" : s.ships_to_za === "no" ? "text-bad" : "text-amber"}>{s.ships_to_za === "unknown" ? "Unconfirmed" : s.ships_to_za}</span></td>
                    <td className="min-w-48 text-xs">{s.shipping_methods || "—"}</td>
                    <td className="min-w-36 text-xs">{s.delivery_estimate || "—"}</td>
                    <td className="min-w-48 text-xs">{s.warranty_terms || "—"}</td>
                    <td className="min-w-56 text-xs"><div className="mb-1"><Cap on={cap.catalog} label="catalogue" /><Cap on={cap.stockSync} label="stock" /><Cap on={cap.priceSync} label="price" /><Cap on={cap.orders} label="orders" /><Cap on={cap.tracking} label="tracking" /></div>{s.api_availability}{s.last_test_at ? <span className={`mt-1 block ${s.last_test_ok ? "text-ok" : "text-bad"}`}>Last test: {s.last_test_ok ? "OK" : "failed"}</span> : null}</td>
                    <td className="min-w-40 text-xs">{s.dropship_support || "—"}</td>
                    <td className="whitespace-nowrap text-xs">{pf ? <>{closed ? `${Math.round((pf.delivered / closed) * 100)}% delivered` : "No completed orders"}<span className="block text-dim">{pf.total} shipments · {pf.failed} failed{pf.avg_delivery_days ? ` · ${pf.avg_delivery_days} d avg` : ""}</span></> : "No orders yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroll>
        <p className="mt-3 text-xs text-dim">Comparison notes are maintained by you on each supplier&rsquo;s page. Products, wholesale range and reliability are live from the database.</p>
      </Card>
      <Card title="Add a supplier" className="mt-6">
        <ActionForm action={addSupplier} className="flex flex-wrap items-end gap-3" inline>
          <div className="min-w-56 flex-1"><Field label="Supplier name" name="name" required /></div>
          <div className="min-w-56"><label className="label" htmlFor="ad">Integration</label><select id="ad" name="adapter" className="field">{Object.values(ADAPTERS).filter((a) => a.key !== "sandbox").map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></div>
          <button className="btn-primary">Add as research</button>
        </ActionForm>
        <p className="mt-3 text-xs text-dim">New suppliers start in “research”. To add a supplier with its own API, a developer adds one adapter module under <code>src/lib/suppliers/</code> and registers it — nothing else in the store changes.</p>
      </Card>
    </>
  );
}
