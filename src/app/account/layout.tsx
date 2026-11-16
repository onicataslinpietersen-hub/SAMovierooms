import Link from "next/link";
import { logout } from "@/app/actions/account";
import { requireUser } from "@/lib/auth";
export const metadata = { title: "Your account", robots: { index: false } };
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const links: [string, string][] = [["Overview", "/account"], ["Orders", "/account/orders"], ["Addresses", "/account/addresses"], ["Wishlist", "/account/wishlist"], ["Support", "/account/support"]];
  return (
    <section className="wrap py-10 sm:py-14">
      <p className="eyebrow">Your account</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">Hello, {u.first_name || "there"}.</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Account" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:px-0">
          {links.map(([l, h]) => <Link key={h} href={h} className="btn btn-sm shrink-0 justify-start border border-white/10 text-sand hover:border-amber hover:text-amber lg:min-h-11">{l}</Link>)}
          <form action={logout}><button className="btn btn-sm w-full shrink-0 justify-start border border-white/10 text-ash hover:text-bad lg:min-h-11">Sign out</button></form>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
