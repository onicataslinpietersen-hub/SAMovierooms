import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHead, Scroll } from "@/components/admin/ui";
import { StatusChip } from "@/components/OrderList";
import { setProductStatus } from "@/app/actions/admin";
import { publishBlockers } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { loadProducts } from "@/lib/catalog";
import { zar } from "@/lib/money";
import { profit } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { RESOLUTION_LABEL } from "@/lib/specs";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const [all, settings] = await Promise.all([loadProducts("all"), getSettings()]);
  const list = all.filter((p) => (!sp.status || p.status === sp.status) && (!sp.q || p.name.toLowerCase().includes(sp.q.toLowerCase()))).sort((a, b) => (a.status === "imported" ? -1 : 0) - (b.status === "imported" ? -1 : 0) || a.name.localeCompare(b.name));
  const counts = (s: string) => all.filter((p) => p.status === s).length;
  return (
    <>
      <PageHead title="Products" sub="Imported products are hidden from customers until you approve and publish them. Publishing is blocked while specifications are unverified or the margin is below your minimum.">
        <Link href="/admin/products/import" className="btn-primary btn-sm">Import from supplier</Link>
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-2">
        {[["", `All (${all.length})`], ["imported", `Awaiting approval (${counts("imported")})`], ["approved", `Approved (${counts("approved")})`], ["published", `Published (${counts("published")})`], ["unpublished", `Unpublished (${counts("unpublished")})`], ["rejected", `Rejected (${counts("rejected")})`]].map(([v, l]) => <Link key={v} href={`/admin/products${v ? `?status=${v}` : ""}`} className={`btn btn-sm border ${(sp.status ?? "") === v ? "border-amber text-amber" : "border-white/12 text-sand"}`}>{l}</Link>)}
        <form className="ml-auto flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Search name…" className="field !min-h-9 w-48" /><button className="btn-ghost btn-sm">Search</button></form>
      </div>
      <div className="panel p-5 sm:p-6"><Scroll>
        <table className="table-admin">
          <thead><tr><th>Product</th><th>Status</th><th>Supplier</th><th className="text-right">Cost</th><th className="text-right">Retail</th><th className="text-right">Est. profit</th><th className="text-right">Margin</th><th className="text-right">Stock</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const v = p.variants.find((x) => x.offer) ?? p.variants[0];
              const m = v?.offer ? profit({ retailCents: v.priceCents, costCents: v.offer.costCents }, settings) : null;
              const blockers = publishBlockers(p, settings);
              const low = m && m.marginBps < settings.min_margin_bps;
              return (
                <tr key={p.id}>
                  <td className="min-w-56"><Link href={`/admin/products/${p.id}`} className="font-medium hover:text-amber">{p.name}</Link><p className="text-xs text-ash">{p.category.name}{RESOLUTION_LABEL[p.resClass] ? ` · ${RESOLUTION_LABEL[p.resClass]}` : ""}{p.isSample ? " · sample" : ""}{p.specsVerified ? "" : " · specs unverified"}</p></td>
                  <td><StatusChip status={p.status} /></td>
                  <td className="text-xs text-sand">{v?.offer?.supplierName ?? <span className="text-bad">No approved offer</span>}</td>
                  <td className="text-right tabular-nums">{v?.offer ? zar(v.offer.costCents) : "—"}</td>
                  <td className="text-right tabular-nums">{v?.priceCents ? zar(v.priceCents) : "—"}{v?.onPromo ? <span className="block text-[10px] text-ok">promo</span> : null}</td>
                  <td className={`text-right tabular-nums ${m && m.grossProfitCents < 0 ? "text-bad" : ""}`}>{m ? zar(m.grossProfitCents) : "—"}</td>
                  <td className={`text-right tabular-nums ${low ? "text-bad" : "text-ok"}`}>{m ? `${(m.marginBps / 100).toFixed(1)}%` : "—"}</td>
                  <td className={`text-right tabular-nums ${p.variants.reduce((s, x) => s + x.stock, 0) === 0 ? "text-bad" : ""}`}>{p.variants.reduce((s, x) => s + x.stock, 0)}</td>
                  <td className="min-w-52">
                    <div className="flex flex-wrap gap-1.5">
                      {p.status === "imported" ? <Btn id={p.id} to="approved" label="Approve" /> : null}
                      {["imported", "approved", "unpublished"].includes(p.status) ? <Btn id={p.id} to="published" label="Publish" primary disabled={!!blockers.length} /> : null}
                      {p.status === "published" ? <Btn id={p.id} to="unpublished" label="Unpublish" /> : null}
                      {p.status === "imported" ? <Btn id={p.id} to="rejected" label="Reject" /> : null}
                      <Link href={`/admin/products/${p.id}`} className="btn-ghost btn-sm">Edit</Link>
                    </div>
                    {blockers.length && p.status !== "published" && p.status !== "rejected" ? <p className="mt-1.5 max-w-xs text-[11px] leading-snug text-amber">Blocked: {blockers[0]}{blockers.length > 1 ? ` (+${blockers.length - 1} more)` : ""}</p> : null}
                  </td>
                </tr>
              );
            })}
            {!list.length ? <tr><td colSpan={9} className="text-ash">No products match.</td></tr> : null}
          </tbody>
        </table>
      </Scroll></div>
      <p className="mt-3 text-xs text-dim">Est. profit = retail − supplier cost − estimated payment fee ({(settings.payment_fee_bps / 100).toFixed(2)}% + R{(settings.payment_fee_fixed_cents / 100).toFixed(2)}), assuming the customer pays delivery. Minimum margin: {(settings.min_margin_bps / 100).toFixed(0)}%.</p>
    </>
  );
}

function Btn({ id, to, label, primary, disabled }: { id: string; to: string; label: string; primary?: boolean; disabled?: boolean }) {
  return <ActionForm action={setProductStatus} inline><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={to} /><button disabled={disabled} className={`${primary ? "btn-primary" : "btn-ghost"} btn-sm`}>{label}</button></ActionForm>;
}
