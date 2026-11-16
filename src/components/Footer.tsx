import Link from "next/link";
import { Logo } from "./Header";
import { NewsletterForm } from "./NewsletterForm";
import type { Settings } from "@/lib/settings";

export function Footer({ nav, settings, demo }: { nav: { slug: string; name: string }[]; settings: Settings; demo: boolean }) {
  const year = new Date().getFullYear();
  const legal = [settings.legal_name, settings.registration_number && `Reg. ${settings.registration_number}`, settings.vat_number && `VAT ${settings.vat_number}`].filter(Boolean);
  return (
    <footer className="relative mt-24 border-t border-white/[0.07] bg-void">
      <div className="rule-glow absolute inset-x-0 -top-px" />
      <div className="wrap grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="display mt-6 text-3xl">Bring the cinema home.</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ash">Premium home cinema for South African homes. Orders are fulfilled and shipped directly by our vetted supplier partners.</p>
          <div className="mt-6 max-w-sm"><NewsletterForm compact /></div>
        </div>
        <FooterCol title="Shop" links={[...nav.map((c) => [c.name, `/c/${c.slug}`] as [string, string]), ["All products", "/shop"]]} />
        <FooterCol title="Support" links={[["Track an order", "/track"], ["Shipping & delivery", "/shipping-policy"], ["Returns & refunds", "/returns-policy"], ["Warranty", "/warranty-policy"], ["FAQ", "/faq"], ["Contact us", "/contact"]]} />
        <FooterCol title="Company" links={[["About SAMovierooms", "/about"], ["Privacy policy", "/privacy-policy"], ["Terms & conditions", "/terms"], ["Your account", "/account"]]} />
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="wrap flex flex-col gap-2 py-6 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {settings.legal_name || "SAMovierooms"}. All prices in South African Rand (ZAR).</p>
          <p>{legal.length ? legal.join(" · ") : demo ? "Company registration details not yet configured (Admin → Settings)." : ""}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-5 space-y-3">
        {links.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-sand transition-colors hover:text-amber">{label}</Link></li>)}
      </ul>
    </div>
  );
}
