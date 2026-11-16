import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Area, Card, Field, PageHead, Scroll } from "@/components/admin/ui";
import { StatusChip } from "@/components/OrderList";
import { saveProduct, savePricingRule, setProductStatus } from "@/app/actions/admin";
import { publishBlockers } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { getCategories, loadProducts } from "@/lib/catalog";
import { q } from "@/lib/db";
import { zar } from "@/lib/money";
import { profit } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { RESOLUTION_LABEL, mayClaimCrystalClear4K } from "@/lib/specs";

export const metadata = { title: "Edit product" };
const KINDS = ["projector", "projector-ust", "projector-portable", "tv", "soundbar", "speakers", "subwoofer", "package", "screen", "mount", "tripod", "cable", "streamer", "remote", "lighting"];
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const [all, cats, settings] = await Promise.all([loadProducts("all"), getCategories(), getSettings()]);
  const p = all.find((x) => x.id === id);
  if (!p) notFound();
  const offers = await q<{ variant: string; supplier: string; status: string; priority: number; supplier_ref: string; cost_cents: number; stock: number; moq: number; last_synced_at: Date | null; source_currency: string; source_amount: string | null }>(
    "SELECT v.name AS variant, s.name AS supplier, s.status, s.priority, sp.supplier_ref, sp.cost_cents, sp.stock, sp.moq, sp.last_synced_at, sp.source_currency, sp.source_amount FROM supplier_products sp JOIN product_variants v ON v.id=sp.variant_id JOIN suppliers s ON s.id=sp.supplier_id WHERE v.product_id=$1 ORDER BY v.sort, s.priority, sp.cost_cents", [id]);
  const blockers = publishBlockers(p, settings);
  return (
    <>
      <PageHead title={p.name} sub={`/p/${p.slug}`}>
        <StatusChip status={p.status} />
        {p.status === "published" ? <Link href={`/p/${p.slug}`} className="btn-ghost btn-sm" target="_blank">View in store</Link> : null}
        <Link href="/admin/products" className="btn-ghost btn-sm">Back</Link>
      </PageHead>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ActionForm action={saveProduct} className="space-y-6">
          <input type="hidden" name="id" value={p.id} />
          <Card title="Listing">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" defaultValue={p.name} required />
              <Field label="URL slug" name="slug" defaultValue={p.slug} />
              <Field label="Brand" name="brand" defaultValue={p.brand} />
              <div><label className="label" htmlFor="f-cat">Category</label><select id="f-cat" name="categoryId" defaultValue={p.category.id} className="field">{cats.filter((c) => c.parent_id).map((c) => <option key={c.id} value={c.id}>{cats.find((x) => x.id === c.parent_id)?.name} › {c.name}</option>)}</select></div>
              <div><label className="label" htmlFor="f-kind">Product type (illustration / 3D model)</label><select id="f-kind" name="kind" defaultValue={p.kind} className="field">{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            </div>
            <div className="mt-4 space-y-4">
              <Area label="Short description" name="shortDescription" defaultValue={p.shortDescription} rows={2} />
              <Area label="Description" name="description" defaultValue={p.description} rows={6} />
              <Area label="Images — one per line: https://url | alt text" name="images" defaultValue={p.images.map((i) => `${i.url} | ${i.alt}`).join("\n")} rows={3} mono hint="Use supplier-licensed or your own photography hosted on your image storage/CDN. Leave empty to use the built-in illustration." />
              <Field label="Product video URL (https, mp4)" name="videoUrl" defaultValue={p.videoUrl ?? ""} />
            </div>
          </Card>
          <Card title="Specifications">
            <Area label="Structured specs (JSON)" name="specs" defaultValue={JSON.stringify(p.specs, null, 2)} rows={16} mono hint='Keys: native_resolution ("1920x1080"), max_input_resolution, brightness_value + brightness_unit ("ANSI lumens" | "ISO lumens"), contrast_ratio, projection_size, throw_ratio, throw_distance, light_source, light_source_life, screen_size, panel_type, refresh_rate, hdr, operating_system, connectivity[], wireless[], speakers, audio_channels, audio_power, battery, input_voltage, plug_type, extra{}' />
            <div className="mt-4 rounded-xl border border-amber/30 bg-amber/[0.05] p-4 text-sm">
              <p>Derived claim: <strong className="text-amber">{RESOLUTION_LABEL[p.resClass] || "none"}</strong> · “Crystal-Clear 4K Entertainment” allowed: <strong>{mayClaimCrystalClear4K(p.specs, p.specsVerified) ? "yes" : "no"}</strong></p>
              <p className="mt-1 text-xs text-ash">The 4K badge comes only from <code>native_resolution</code>. A product that merely accepts 4K input is labelled “4K input supported”.</p>
              <label className="mt-3 flex items-start gap-3"><input type="checkbox" name="specsVerified" defaultChecked={p.specsVerified} className="mt-0.5 h-5 w-5 accent-[#f5a83a]" /><span>I have verified these specifications against the manufacturer&rsquo;s datasheet and/or a tested sample. <span className="text-ash">Required before publishing.</span></span></label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Weight (g)" name="weightG" type="number" defaultValue={p.weightG} />
              <Field label="Length (mm)" name="lengthMm" type="number" defaultValue={p.lengthMm} />
              <Field label="Width (mm)" name="widthMm" type="number" defaultValue={p.widthMm} />
              <Field label="Height (mm)" name="heightMm" type="number" defaultValue={p.heightMm} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Area label="Warranty (shown to customers)" name="warranty" defaultValue={p.warranty} rows={3} />
              <Area label="Returns information (optional override)" name="returnsInfo" defaultValue={p.returnsInfo} rows={3} />
            </div>
          </Card>
          <Card title="Price, promotion & merchandising">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Individual retail price (R) — overrides markup rules" name="priceOverride" defaultValue={p.overrideCents ? (p.overrideCents / 100).toFixed(2) : ""} inputMode="decimal" hint="Leave empty to use markup rules." />
              <Field label="Promotional price (R)" name="promoPrice" defaultValue={p.promoCents ? (p.promoCents / 100).toFixed(2) : ""} inputMode="decimal" />
              <Field label="Promo starts" name="promoStarts" type="date" defaultValue={day(p.promoStarts)} />
              <Field label="Promo ends" name="promoEnds" type="date" defaultValue={day(p.promoEnds)} />
              <Field label="SEO title" name="seoTitle" defaultValue="" />
              <Field label="SEO description" name="seoDescription" defaultValue="" />
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={p.featured} className="h-5 w-5 accent-[#f5a83a]" />Featured on homepage</label><label className="flex items-center gap-2"><input type="checkbox" name="bestSeller" defaultChecked={p.bestSeller} className="h-5 w-5 accent-[#f5a83a]" />Best seller</label></div>
          </Card>
          <button className="btn-primary">Save product</button>
        </ActionForm>

        <div className="space-y-6">
          <Card title="Publishing">
            {blockers.length ? <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-amber">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="mb-4 text-sm text-ok">All publishing checks pass.</p>}
            <div className="flex flex-wrap gap-2">
              {p.status !== "published" ? <ActionForm action={setProductStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="published" /><button className="btn-primary btn-sm" disabled={!!blockers.length}>Publish</button></ActionForm> : <ActionForm action={setProductStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="unpublished" /><button className="btn-ghost btn-sm">Unpublish</button></ActionForm>}
              {p.status === "imported" ? <ActionForm action={setProductStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="approved" /><button className="btn-ghost btn-sm">Approve (keep hidden)</button></ActionForm> : null}
            </div>
          </Card>
          <Card title="Profit per variant (private)">
            <Scroll><table className="table-admin"><thead><tr><th>Variant</th><th className="text-right">Cost</th><th className="text-right">Retail</th><th className="text-right">Fees</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead>
              <tbody>{p.variants.map((v) => { const m = v.offer ? profit({ retailCents: v.priceCents, costCents: v.offer.costCents }, settings) : null; return (
                <tr key={v.id}><td>{v.name}<span className="block text-[10px] text-dim">{v.priceSource.replace(/_/g, " ")}</span></td><td className="text-right tabular-nums">{v.offer ? zar(v.offer.costCents) : "—"}</td><td className="text-right tabular-nums">{zar(v.priceCents)}</td><td className="text-right tabular-nums">{m ? zar(m.feeCents) : "—"}</td><td className={`text-right tabular-nums ${m && m.grossProfitCents < 0 ? "text-bad" : ""}`}>{m ? zar(m.grossProfitCents) : "—"}</td><td className={`text-right tabular-nums ${m && m.marginBps < settings.min_margin_bps ? "text-bad" : "text-ok"}`}>{m ? `${(m.marginBps / 100).toFixed(1)}%` : "—"}</td></tr>); })}</tbody></table></Scroll>
            <p className="mt-3 text-xs text-dim">Assumes the customer pays delivery, so shipping nets to zero. If you absorb delivery or DDP import costs for a promotion, subtract them from the profit shown.</p>
            <ActionForm action={savePricingRule} className="mt-4 border-t border-white/[0.07] pt-4">
              <input type="hidden" name="scope" value="product" /><input type="hidden" name="productId" value={p.id} />
              <p className="label">Product-specific markup</p>
              <div className="flex gap-2"><select name="kind" className="field w-32"><option value="percent">% markup</option><option value="fixed">+ Rand</option></select><input name="value" type="number" step="0.01" min="0" required placeholder="e.g. 40" className="field" /><button className="btn-ghost btn-sm shrink-0">Apply</button></div>
            </ActionForm>
          </Card>
          <Card title="Supplier offers (compare wholesale)">
            <Scroll><table className="table-admin"><thead><tr><th>Variant</th><th>Supplier</th><th className="text-right">Cost</th><th className="text-right">Stock</th><th>MOQ</th><th>Synced</th></tr></thead>
              <tbody>{offers.map((o, i) => <tr key={i}><td>{o.variant}</td><td>{o.supplier}<span className="block text-[10px] text-dim">{o.status.replace(/_/g, " ")} · priority {o.priority} · {o.supplier_ref}</span></td><td className="text-right tabular-nums">{zar(o.cost_cents)}{o.source_currency !== "ZAR" ? <span className="block text-[10px] text-dim">{o.source_currency} {o.source_amount}</span> : null}</td><td className={`text-right tabular-nums ${o.stock ? "" : "text-bad"}`}>{o.stock}</td><td>{o.moq}</td><td className="text-xs text-ash">{o.last_synced_at?.toLocaleDateString("en-ZA") ?? "—"}</td></tr>)}</tbody></table></Scroll>
            <p className="mt-3 text-xs text-dim">The store sells from the in-stock offer of the highest-priority approved supplier, then the lowest cost.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
