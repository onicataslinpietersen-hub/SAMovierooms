import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Area, Card, Field, PageHead } from "@/components/admin/ui";
import { saveSupplier, syncSupplier, testSupplier } from "@/app/actions/admin";
import { requireStaff } from "@/lib/auth";
import { decryptJson } from "@/lib/crypto";
import { q } from "@/lib/db";
import { adapterFor, getSupplier } from "@/lib/suppliers";
import { dt } from "@/components/admin/ui";

export const metadata = { title: "Supplier" };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const s = await getSupplier(Number((await params).id));
  if (!s) notFound();
  const adapter = adapterFor(s.adapter);
  const creds = decryptJson<Record<string, string>>(s.credentials_enc) ?? {};
  const errors = await q<{ idempotency_key: string; status: string; last_error: string; updated_at: Date; order_id: string }>("SELECT idempotency_key, status, last_error, updated_at, order_id FROM fulfillments WHERE supplier_id=$1 AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 15", [s.id]);
  const cap = adapter.capabilities;
  return (
    <>
      <PageHead title={s.name} sub={`${adapter.label} — ${adapter.notes}`}><Link href="/admin/suppliers" className="btn-ghost btn-sm">Back</Link></PageHead>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ActionForm action={saveSupplier} className="space-y-6">
          <input type="hidden" name="id" value={s.id} />
          <Card title="Status & priority">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label" htmlFor="st">Status</label><select id="st" name="status" defaultValue={s.status} className="field"><option value="research">Research</option><option value="pending_verification">Pending verification</option><option value="approved">Approved — can sell</option><option value="suspended">Suspended</option></select></div>
              <Field label="Priority (lower = preferred)" name="priority" type="number" defaultValue={s.priority} />
              <Field label="Warehouse country (ISO)" name="warehouseCountry" defaultValue={s.warehouse_country} maxLength={2} />
            </div>
            {s.status !== "approved" ? (
              <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/[0.05] p-4 text-sm"><input type="checkbox" name="confirmVerified" className="mt-0.5 h-5 w-5 accent-[#f5a83a]" /><span>I confirm that we ordered and tested a sample from this supplier, obtained real shipping quotes to South Africa (including duties), and completed a test order end to end. <span className="text-ash">Required to approve.</span></span></label>
            ) : null}
          </Card>
          <Card title="Comparison notes">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" defaultValue={s.name} />
              <Field label="Website" name="website" defaultValue={s.website} />
              <div><label className="label" htmlFor="sz">Ships to South Africa</label><select id="sz" name="shipsToZa" defaultValue={s.ships_to_za} className="field"><option value="unknown">Unconfirmed</option><option value="yes">Yes</option><option value="no">No</option></select></div>
              <Field label="Minimum order quantity" name="moqNotes" defaultValue={s.moq_notes} />
              <Field label="Shipping methods" name="shippingMethods" defaultValue={s.shipping_methods} />
              <Field label="Estimated delivery to SA" name="deliveryEstimate" defaultValue={s.delivery_estimate} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Area label="Verification status & notes" name="verificationNotes" defaultValue={s.verification_notes} rows={4} hint="Business licence, years trading, Trade Assurance, review consistency, sample results." />
              <Area label="Warranty terms" name="warrantyTerms" defaultValue={s.warranty_terms} rows={4} />
              <Area label="API availability" name="apiAvailability" defaultValue={s.api_availability} rows={3} />
              <Area label="Dropshipping support" name="dropshipSupport" defaultValue={s.dropship_support} rows={3} />
            </div>
          </Card>
          {adapter.credentialFields.length ? (
            <Card title="API credentials">
              <p className="mb-4 text-xs text-ash">Stored encrypted (AES-256-GCM). Saved secrets are never shown again — leave a field empty to keep the current value.</p>
              <div className="space-y-4">
                {adapter.credentialFields.map((f) => f.secret
                  ? <Field key={f.key} label={`${f.label}${creds[f.key] ? " — saved ✓" : ""}`} name={`cred_${f.key}`} type="password" autoComplete="off" placeholder={creds[f.key] ? "•••••••• (unchanged)" : ""} />
                  : <Area key={f.key} label={f.label} name={`cred_${f.key}`} defaultValue={creds[f.key] ?? ""} rows={f.key === "rate_card" ? 6 : 2} mono={f.key === "rate_card"} />)}
              </div>
            </Card>
          ) : null}
          <button className="btn-primary">Save supplier</button>
        </ActionForm>

        <div className="space-y-6">
          <Card title="Connection">
            <ul className="mb-4 grid grid-cols-2 gap-2 text-xs">{([["Catalogue import", cap.catalog], ["Stock sync", cap.stockSync], ["Price sync", cap.priceSync], ["Automatic ordering", cap.orders], ["Tracking sync", cap.tracking], ["API cancellation", cap.cancel]] as [string, boolean][]).map(([l, on]) => <li key={l} className={`rounded-lg px-3 py-2 ${on ? "bg-ok/10 text-ok" : "bg-white/[0.04] text-ash"}`}>{on ? "✓" : "—"} {l}{on ? "" : " (manual)"}</li>)}</ul>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={testSupplier}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost btn-sm">Test connection</button></ActionForm>
              {cap.stockSync || cap.priceSync ? <ActionForm action={syncSupplier}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost btn-sm">Sync stock & prices now</button></ActionForm> : null}
              {cap.catalog ? <Link href={`/admin/products/import?supplier=${s.id}&q=`} className="btn-ghost btn-sm">Browse catalogue</Link> : null}
            </div>
            {s.last_test_at ? <p className={`mt-3 text-xs ${s.last_test_ok ? "text-ok" : "text-bad"}`}>Last test {dt(s.last_test_at)}: {s.last_test_message}</p> : null}
          </Card>
          <Card title="Recent fulfilment errors">
            {errors.length ? <ul className="space-y-3 text-xs">{errors.map((e, i) => <li key={i} className="rounded-lg bg-white/[0.03] p-3"><Link href={`/admin/orders/${e.order_id}`} className="font-mono text-amber hover:underline">{e.idempotency_key}</Link> · {e.status} · {dt(e.updated_at)}<p className="mt-1 text-ash">{e.last_error}</p></li>)}</ul> : <p className="text-sm text-ash">No fulfilment errors recorded.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
