import Link from "next/link";
import { env } from "@/lib/env";
import { getSettings, type Settings } from "@/lib/settings";

const PAGES: [string, string][] = [["Shipping & delivery", "/shipping-policy"], ["Returns & refunds", "/returns-policy"], ["Warranty", "/warranty-policy"], ["Privacy", "/privacy-policy"], ["Terms & conditions", "/terms"]];

/** Business details come from Admin → Settings. Nothing is invented: unset fields are shown as not yet provided. */
export function BusinessDetails({ s }: { s: Settings }) {
  const rows: [string, string][] = [["Trading name", "SAMovierooms"], ["Registered name", s.legal_name], ["Registration number", s.registration_number], ["VAT number", s.vat_number], ["Physical address", s.physical_address], ["Email", s.support_email], ["Telephone", s.support_phone], ["Information Officer (POPIA)", s.information_officer]];
  return (
    <dl className="not-prose my-6 divide-y divide-white/[0.07] rounded-2xl border border-white/10 px-5">
      {rows.filter(([k, v]) => v || env.demoMode || k === "Trading name").map(([k, v]) => <div key={k} className="grid grid-cols-[42%_1fr] gap-4 py-3 text-sm"><dt className="text-ash">{k}</dt><dd className={v ? "text-cream" : "text-dim italic"}>{v || "Not yet provided — set in Admin → Settings"}</dd></div>)}
    </dl>
  );
}

export async function LegalPage({ title, intro, updated, children }: { title: string; intro: string; updated: string; children: (s: Settings) => React.ReactNode }) {
  const s = await getSettings();
  return (
    <section className="wrap grid gap-12 py-12 sm:py-16 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Policies" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
        {PAGES.map(([l, h]) => <Link key={h} href={h} className="btn btn-sm shrink-0 justify-start border border-white/10 text-sand hover:border-amber hover:text-amber lg:min-h-11">{l}</Link>)}
      </nav>
      <article className="prose-legal max-w-3xl">
        <p className="eyebrow">Policies</p>
        <h1 className="display mt-4 text-5xl sm:text-6xl">{title}</h1>
        <p className="lede mt-5 !mb-2">{intro}</p>
        <p className="!text-xs !text-dim">Last updated {updated}</p>
        {env.demoMode ? <p className="rounded-2xl border border-amber/40 bg-amber/[0.07] p-4 !text-sm !text-gold">Draft policy. This text was written to reflect South African consumer law (CPA, ECT Act, POPIA) but has not been reviewed by an attorney. Have it reviewed, and complete the business details in Admin → Settings, before trading.</p> : null}
        {children(s)}
      </article>
    </section>
  );
}
