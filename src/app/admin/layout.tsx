import Link from "next/link";
import { logout } from "@/app/actions/account";
import { requireStaff } from "@/lib/auth";
import { q1 } from "@/lib/db";

export const metadata = { title: { default: "Admin", template: "%s · SAMovierooms Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaff(["admin", "support"]);
  const c = (await q1<{ alerts: number; tickets: number; manual: number; imported: number }>(
    `SELECT (SELECT count(*) FROM alerts WHERE resolved_at IS NULL)::int AS alerts, (SELECT count(*) FROM support_tickets WHERE status='open')::int AS tickets,
            (SELECT count(*) FROM fulfillments f JOIN orders o ON o.id=f.order_id WHERE o.paid_at IS NOT NULL AND f.status IN ('awaiting_manual','failed','unknown','cancel_requested'))::int AS manual,
            (SELECT count(*) FROM products WHERE status='imported')::int AS imported`))!;
  const admin = u.role === "admin";
  const nav: [string, string, number?][] = [["Overview", "/admin", c.alerts], ["Orders", "/admin/orders", c.manual], ...(admin ? [["Products", "/admin/products", c.imported], ["Suppliers", "/admin/suppliers"], ["Pricing", "/admin/pricing"], ["Finance", "/admin/finance"]] as [string, string, number?][] : []), ["Support & reviews", "/admin/support", c.tickets], ["Email outbox", "/admin/outbox"], ...(admin ? [["Settings", "/admin/settings"]] as [string, string][] : [])];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[230px_1fr]">
      <aside className="border-b border-white/[0.07] bg-void lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-5 lg:block">
          <Link href="/admin" className="text-sm font-semibold"><span className="gold-text">SA</span>Movierooms <span className="chip ml-1">Admin</span></Link>
          <Link href="/" className="text-xs text-ash hover:text-amber lg:mt-2 lg:block">← View store</Link>
        </div>
        <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
          {nav.map(([l, h, n]) => <Link key={h} href={h} className="flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-sm text-sand transition-colors hover:bg-white/5 hover:text-cream">{l}{n ? <span className="rounded-full bg-amber px-1.5 text-[10px] font-bold text-void">{n}</span> : null}</Link>)}
        </nav>
        <div className="hidden p-5 text-xs text-dim lg:block"><p className="truncate">{u.email}</p><p className="capitalize">{u.role}</p><form action={logout}><button className="mt-2 text-ash hover:text-bad">Sign out</button></form></div>
      </aside>
      <div className="min-w-0 p-5 sm:p-8">{children}</div>
    </div>
  );
}
