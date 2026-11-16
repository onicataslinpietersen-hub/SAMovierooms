import { ActionForm } from "@/components/admin/ActionForm";
import { Card, Field, PageHead, Scroll } from "@/components/admin/ui";
import { deleteBundle, deletePricingRule, saveBundle, saveDiscount, savePricingRule, saveSettings, toggleDiscount } from "@/app/actions/admin";
import { requireStaff } from "@/lib/auth";
import { getCategories, loadProducts } from "@/lib/catalog";
import { q } from "@/lib/db";
import { zar } from "@/lib/money";
import { profit } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Pricing" };

export default async function Pricing() {
  await requireStaff();
  const [rules, cats, products, settings, discounts, bundles] = await Promise.all([
    q<{ id: number; scope: string; category_id: number | null; product_id: string | null; kind: string; value: number }>("SELECT * FROM pricing_rules ORDER BY scope, id"),
    getCategories(), loadProducts("all"), getSettings(),
    q<{ id: number; code: string; kind: string; value: number; min_subtotal_cents: number; max_uses: number | null; used: number; ends_at: Date | null; active: boolean }>("SELECT * FROM discounts ORDER BY id DESC"),
    q<{ id: number; name: string; percent_off_bps: number; product_ids: string[] }>("SELECT * FROM bundles ORDER BY id DESC"),
  ]);
  const show = (r: { kind: string; value: number }) => (r.kind === "percent" ? `+${(r.value / 100).toFixed(r.value % 100 ? 1 : 0)}%` : `+${zar(r.value)}`);
  const global = rules.find((r) => r.scope === "global");
  const example = { cost: 200000, ship: 30000, retail: 399900 };
  const ex = profit({ retailCents: example.retail, costCents: example.cost, shippingCostCents: example.ship }, settings);
  return (
    <>
      <PageHead title="Pricing" sub="Retail price = supplier cost + markup. An individual product price beats a product rule, which beats a category rule, which beats the global rule. Promotional prices are set on each product." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Markup rules">
          <Scroll><table className="table-admin"><thead><tr><th>Applies to</th><th>Markup</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => <tr key={r.id}><td>{r.scope === "global" ? "Everything (global default)" : r.scope === "category" ? `Category: ${cats.find((c) => c.id === r.category_id)?.name ?? "?"}` : `Product: ${products.find((p) => p.id === r.product_id)?.name ?? "?"}`}</td><td className="tabular-nums">{show(r)}</td><td className="text-right">{r.scope !== "global" ? <form action={deletePricingRule}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-ash hover:text-bad">Remove</button></form> : null}</td></tr>)}
              {!rules.length ? <tr><td colSpan={3} className="text-amber">No rules — products without an individual price cannot be sold.</td></tr> : null}
            </tbody></table></Scroll>
          <ActionForm action={savePricingRule} className="mt-5 grid gap-3 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
            <div><label className="label" htmlFor="sc">Scope</label><select id="sc" name="scope" className="field"><option value="global">Global default{global ? ` (replaces ${show(global)})` : ""}</option><option value="category">Category</option></select></div>
            <div><label className="label" htmlFor="ci">Category (for category scope)</label><select id="ci" name="categoryId" className="field">{cats.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.name}</option>)}</select></div>
            <div><label className="label" htmlFor="kd">Type</label><select id="kd" name="kind" className="field"><option value="percent">Percentage markup</option><option value="fixed">Fixed markup (Rand)</option></select></div>
            <Field label="Value (% or R)" name="value" type="number" step="0.01" min="0" required />
            <div className="sm:col-span-2"><button className="btn-primary btn-sm">Save rule</button></div>
          </ActionForm>
        </Card>

        <Card title="Profit guard">
          <ActionForm action={saveSettings} className="grid gap-4 sm:grid-cols-3">
            <Field label="Minimum margin (%)" name="min_margin_bps" type="number" step="0.5" min="0" max="100" defaultValue={settings.min_margin_bps / 100} hint="Products below this cannot be published and are unpublished automatically if a supplier raises its price." />
            <Field label="Payment fee (%)" name="payment_fee_bps" type="number" step="0.01" min="0" max="100" defaultValue={settings.payment_fee_bps / 100} hint="From your gateway agreement." />
            <Field label="Payment fee fixed (R)" name="payment_fee_fixed_cents" inputMode="decimal" defaultValue={(settings.payment_fee_fixed_cents / 100).toFixed(2)} />
            <div className="sm:col-span-3"><button className="btn-primary btn-sm">Save</button></div>
          </ActionForm>
          <div className="mt-5 rounded-xl bg-white/[0.03] p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-ash">Worked example (illustrative figures)</p>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between"><dt>Retail price</dt><dd className="tabular-nums">{zar(example.retail)}</dd></div>
              <div className="flex justify-between text-ash"><dt>− Supplier cost</dt><dd className="tabular-nums">{zar(example.cost)}</dd></div>
              <div className="flex justify-between text-ash"><dt>− Shipping paid by the business</dt><dd className="tabular-nums">{zar(example.ship)}</dd></div>
              <div className="flex justify-between text-ash"><dt>− Payment fees (your settings)</dt><dd className="tabular-nums">{zar(ex.feeCents, { decimals: true })}</dd></div>
              <div className="flex justify-between border-t border-white/[0.08] pt-2 font-semibold text-ok"><dt>= Estimated gross profit</dt><dd className="tabular-nums">{zar(ex.grossProfitCents, { decimals: true })} ({(ex.marginBps / 100).toFixed(1)}%)</dd></div>
            </dl>
          </div>
        </Card>

        <Card title="Discount codes">
          <Scroll><table className="table-admin"><thead><tr><th>Code</th><th>Value</th><th>Min. spend</th><th>Used</th><th>Expires</th><th /></tr></thead>
            <tbody>{discounts.map((d) => <tr key={d.id} className={d.active ? "" : "opacity-50"}><td className="font-mono font-semibold">{d.code}</td><td>{d.kind === "percent" ? `${d.value / 100}%` : zar(d.value)}</td><td>{zar(d.min_subtotal_cents)}</td><td>{d.used}{d.max_uses ? ` / ${d.max_uses}` : ""}</td><td>{d.ends_at?.toLocaleDateString("en-ZA") ?? "—"}</td><td className="text-right"><form action={toggleDiscount}><input type="hidden" name="id" value={d.id} /><button className="text-xs text-ash hover:text-amber">{d.active ? "Disable" : "Enable"}</button></form></td></tr>)}</tbody></table></Scroll>
          <ActionForm action={saveDiscount} className="mt-5 grid gap-3 border-t border-white/[0.07] pt-5 sm:grid-cols-3">
            <Field label="Code" name="code" required />
            <div><label className="label" htmlFor="dk">Type</label><select id="dk" name="kind" className="field"><option value="percent">% off</option><option value="fixed">Rand off</option></select></div>
            <Field label="Value" name="value" type="number" step="0.01" min="0" required />
            <Field label="Minimum spend (R)" name="minSubtotal" inputMode="decimal" />
            <Field label="Max uses" name="maxUses" type="number" min="1" />
            <Field label="Expires" name="endsAt" type="date" />
            <div className="sm:col-span-3"><button className="btn-primary btn-sm">Save discount code</button></div>
          </ActionForm>
          <p className="mt-3 text-xs text-dim">Discounts reduce profit on each order they are used on — the order&rsquo;s profit figure reflects the price actually paid.</p>
        </Card>

        <Card title="Bundle discounts">
          {bundles.length ? <ul className="space-y-3">{bundles.map((b) => <li key={b.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] p-3 text-sm"><span><strong>{b.name}</strong> — {b.percent_off_bps / 100}% off when bought together<span className="block text-xs text-ash">{b.product_ids.map((id) => products.find((p) => p.id === id)?.name ?? "?").join(" + ")}</span></span><form action={deleteBundle}><input type="hidden" name="id" value={b.id} /><button className="text-xs text-ash hover:text-bad">Remove</button></form></li>)}</ul> : <p className="text-sm text-ash">No bundles yet.</p>}
          <ActionForm action={saveBundle} className="mt-5 space-y-3 border-t border-white/[0.07] pt-5">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Bundle name" name="name" required /><Field label="Discount (%)" name="percent" type="number" step="0.5" min="0.5" max="50" required /></div>
            <div><label className="label" htmlFor="bp">Products (hold Ctrl/Cmd to choose several)</label><select id="bp" name="productIds" multiple size={7} className="field !h-auto py-2">{products.filter((p) => p.status === "published").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <button className="btn-primary btn-sm">Save bundle</button>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
