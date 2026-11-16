import { ActionForm } from "@/components/admin/ActionForm";
import { Area, Card, Field, PageHead } from "@/components/admin/ui";
import { saveCategoryCustoms, saveSettings } from "@/app/actions/admin";
import { requireStaff } from "@/lib/auth";
import { getCategories } from "@/lib/catalog";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function Settings() {
  await requireStaff();
  const [s, cats] = await Promise.all([getSettings(), getCategories()]);
  const checks: [string, boolean, string][] = [
    ["Demo mode is off", !env.demoMode, "DEMO_MODE=false"],
    ["Live payment gateway selected", env.paymentProvider !== "sandbox", "PAYMENT_PROVIDER=payfast with merchant credentials"],
    ["PayFast is not in sandbox", env.paymentProvider === "payfast" && !env.payfast.sandbox, "PAYFAST_SANDBOX=false"],
    ["Email delivery configured", !!env.smtpUrl, "SMTP_URL"],
    ["Background sync secret set", env.cronSecret.length >= 16, "CRON_SECRET + a scheduler calling /api/cron/sync"],
    ["Company details completed", !!(s.legal_name && s.physical_address && s.support_email && s.support_phone), "Business details below (ECT Act s43)"],
    ["Information Officer named", !!s.information_officer, "POPIA"],
    ["Customs duty rates confirmed", cats.filter((c) => !c.parent_id).every((c) => c.duty_verified), "Customs table below"],
  ];
  return (
    <>
      <PageHead title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Launch checklist">
          <ul className="space-y-2 text-sm">{checks.map(([l, ok, how]) => <li key={l} className="flex items-start gap-3"><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ok ? "bg-ok text-void" : "bg-amber/20 text-amber"}`}>{ok ? "✓" : "!"}</span><span>{l}{ok ? "" : <span className="block text-xs text-ash">{how}</span>}</span></li>)}</ul>
          <p className="mt-4 text-xs text-dim">Also required and not checkable from here: a tested sample from every approved supplier, real shipping quotes to South Africa, an end-to-end live test order, and a legal review of the policy pages.</p>
        </Card>
        <Card title="Business details (shown on the site)">
          <ActionForm action={saveSettings} className="grid gap-4 sm:grid-cols-2">
            <Field label="Registered company name" name="legal_name" defaultValue={s.legal_name} />
            <Field label="Company registration number" name="registration_number" defaultValue={s.registration_number} />
            <Field label="VAT number (if registered)" name="vat_number" defaultValue={s.vat_number} />
            <Field label="POPIA Information Officer" name="information_officer" defaultValue={s.information_officer} />
            <Field label="Support email" name="support_email" type="email" defaultValue={s.support_email} />
            <Field label="Support phone" name="support_phone" defaultValue={s.support_phone} />
            <div className="sm:col-span-2"><Area label="Physical address" name="physical_address" defaultValue={s.physical_address} rows={2} /></div>
            <Field label="Change-of-mind return window (days)" name="returns_window_days" type="number" min="0" defaultValue={s.returns_window_days} hint="0 or 7 = statutory 7 days only. A larger number extends it on the policy page." />
            <div className="sm:col-span-2"><p className="mb-3 text-xs text-dim">Only what you enter here is displayed. Nothing is pre-filled or invented.</p><button className="btn-primary btn-sm">Save details</button></div>
          </ActionForm>
        </Card>
        <Card title="Import cost model">
          <ActionForm action={saveSettings} className="grid gap-4 sm:grid-cols-3">
            <Field label="Import VAT (%)" name="vat_bps" type="number" step="0.1" min="0" max="100" defaultValue={s.vat_bps / 100} />
            <Field label="Customs value uplift (%)" name="customs_uplift_bps" type="number" step="0.1" min="0" max="100" defaultValue={s.customs_uplift_bps / 100} hint="VAT base = (value + uplift) + duty." />
            <Field label="USD → ZAR rate" name="usd_zar" type="number" step="0.0001" min="0" defaultValue={s.usd_zar || ""} hint="Used to convert USD supplier prices. 0 = not set." />
            <div className="sm:col-span-3"><button className="btn-primary btn-sm">Save</button></div>
          </ActionForm>
        </Card>
        <Card title="Customs duty by category">
          <p className="mb-4 text-xs leading-relaxed text-ash">Enter the tariff heading and duty rate your clearing agent or SARS confirms for each category. Until a rate is marked confirmed, customers are told the import estimate covers VAT only and that duty may apply. Sub-categories inherit their parent unless set.</p>
          <ul className="space-y-3">
            {cats.map((c) => (
              <li key={c.id} className={c.parent_id ? "ml-5" : ""}>
                <ActionForm action={saveCategoryCustoms} className="flex flex-wrap items-end gap-2" inline>
                  <input type="hidden" name="id" value={c.id} />
                  <span className={`w-44 pb-3 text-sm ${c.parent_id ? "text-sand" : "font-semibold"}`}>{c.name}</span>
                  <div className="w-32"><label className="label" htmlFor={`th-${c.id}`}>Tariff heading</label><input id={`th-${c.id}`} name="tariffHeading" defaultValue={c.tariff_heading ?? ""} className="field !min-h-9" placeholder="e.g. 8528.xx" /></div>
                  <div className="w-24"><label className="label" htmlFor={`dr-${c.id}`}>Duty %</label><input id={`dr-${c.id}`} name="dutyRate" type="number" step="0.1" min="0" max="100" defaultValue={c.duty_rate_bps / 100} className="field !min-h-9" /></div>
                  <label className="flex items-center gap-2 pb-2.5 text-xs text-sand"><input type="checkbox" name="verified" defaultChecked={c.duty_verified} className="h-4 w-4 accent-[#f5a83a]" />Confirmed</label>
                  <button className="btn-ghost btn-sm mb-0.5">Save</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
