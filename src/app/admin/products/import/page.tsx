import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, PageHead } from "@/components/admin/ui";
import { importProduct } from "@/app/actions/admin";
import { requireStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { zar } from "@/lib/money";
import { adapterFor, listSuppliers, supplierContext } from "@/lib/suppliers";
import type { CatalogItem } from "@/lib/suppliers/types";
import { RESOLUTION_LABEL, resolutionClass } from "@/lib/specs";

export const metadata = { title: "Import products" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ supplier?: string; q?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const suppliers = (await listSuppliers()).filter((s) => adapterFor(s.adapter).capabilities.catalog);
  const current = suppliers.find((s) => String(s.id) === sp.supplier) ?? null;
  let items: CatalogItem[] = [], error = "";
  if (current && sp.q !== undefined) {
    try { items = await adapterFor(current.adapter).searchCatalog!(await supplierContext(current), sp.q); } catch (e) { error = (e as Error).message; }
  }
  const have = new Set((await q<{ supplier_ref: string }>("SELECT supplier_ref FROM supplier_products WHERE supplier_id=$1", [current?.id ?? 0])).map((r) => r.supplier_ref));
  return (
    <>
      <PageHead title="Import from supplier" sub="Search a connected supplier's catalogue and import products for review. Imports are never visible to customers until approved and published."><Link href="/admin/products" className="btn-ghost btn-sm">Back to products</Link></PageHead>
      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1"><label className="label" htmlFor="sup">Supplier</label><select id="sup" name="supplier" defaultValue={sp.supplier} className="field">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.status.replace(/_/g, " ")}</option>)}</select></div>
          <div className="min-w-56 flex-[2]"><label className="label" htmlFor="iq">Search catalogue</label><input id="iq" name="q" defaultValue={sp.q} placeholder="e.g. projector (leave empty to list all)" className="field" /></div>
          <button className="btn-primary">Search</button>
        </form>
        {current && current.status !== "approved" ? <p className="mt-3 rounded-lg bg-amber/10 p-3 text-xs text-gold">{current.name} is not approved yet. You can import its products for evaluation, but they cannot be published or sold until the supplier is approved.</p> : null}
        {error ? <p className="mt-3 rounded-lg bg-bad/10 p-3 text-sm text-bad">Supplier API error: {error}</p> : null}
      </Card>
      {items.length ? (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {items.map((it) => {
            const rc = resolutionClass(it.specs), done = it.variants.some((v) => have.has(v.ref));
            return (
              <li key={it.ref} className="panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-semibold">{it.name}</p><p className="text-xs text-ash">{it.ref} · {it.categorySlug || "uncategorised"} · {it.variants.length} variant(s){RESOLUTION_LABEL[rc] ? ` · ${RESOLUTION_LABEL[rc]}` : ""}</p></div>
                  <p className="shrink-0 text-right text-sm"><span className="font-semibold tabular-nums">{it.variants[0] ? zar(it.variants[0].costCents) : "—"}</span><span className="block text-[10px] text-dim">wholesale · stock {it.variants.reduce((s, v) => s + v.stock, 0)}</span></p>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-sand">{it.shortDescription || it.description}</p>
                {!Object.keys(it.specs).length ? <p className="mt-2 text-xs text-amber">No structured specifications from this supplier — you will need to enter and verify them.</p> : null}
                <ActionForm action={importProduct} className="mt-4"><input type="hidden" name="supplierId" value={current!.id} /><input type="hidden" name="query" value={sp.q ?? ""} /><input type="hidden" name="ref" value={it.ref} /><button className={done ? "btn-ghost btn-sm" : "btn-primary btn-sm"}>{done ? "Refresh offer" : "Import for review"}</button></ActionForm>
              </li>
            );
          })}
        </ul>
      ) : current && sp.q !== undefined && !error ? <p className="mt-6 text-sm text-ash">No catalogue items matched.</p> : null}
      {!suppliers.length ? <p className="mt-6 text-sm text-ash">No connected supplier has a catalogue API. Products from manual suppliers are added by importing a sample and editing it.</p> : null}
    </>
  );
}
