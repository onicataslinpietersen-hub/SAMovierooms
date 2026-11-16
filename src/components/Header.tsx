"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";
import { IconCart, IconClose, IconMenu, IconSearch, IconUser } from "./Icons";

type Nav = { slug: string; name: string; tagline: string; children: { slug: string; name: string }[] }[];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group flex items-center gap-2.5 ${className}`} aria-label="SAMovierooms home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe2b0" /><stop offset="1" stopColor="#e08a25" /></linearGradient></defs>
        <rect x="1.500" y="6" width="29" height="20" rx="5" fill="none" stroke="url(#lg)" strokeWidth="1.800" />
        <path d="M13 11.500v9l8-4.500-8-4.500Z" fill="url(#lg)" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight"><span className="gold-text">SA</span>Movierooms</span>
    </Link>
  );
}

export function Header({ nav, user }: { nav: Nav; user: { firstName: string; isStaff: boolean } | null }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const setOpen = useCart((s) => s.setOpen);

  useEffect(() => {
    setMounted(true);
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setMenu(false); setHover(null); }, [path]);
  useEffect(() => { document.body.style.overflow = menu ? "hidden" : ""; }, [menu]);

  if (path.startsWith("/admin")) return null;
  const solid = scrolled || path !== "/" || !!hover;

  return (
    <header className={`sticky inset-x-0 top-0 z-50 transition-all duration-500 ${solid ? "border-b border-white/[0.07] bg-coal/80 backdrop-blur-xl" : "bg-gradient-to-b from-black/60 to-transparent"}`} onMouseLeave={() => setHover(null)}>
      <div className="wrap flex h-[68px] items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} onMouseEnter={() => setHover(c.slug)} onFocus={() => setHover(c.slug)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${hover === c.slug || path.startsWith(`/c/${c.slug}`) ? "text-amber" : "text-sand hover:text-cream"}`}>
              {c.name}
            </Link>
          ))}
          <Link href="/#build" className="rounded-full px-4 py-2 text-sm font-medium text-sand transition-colors hover:text-cream">Build your cinema</Link>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/shop" aria-label="Search products" className="grid h-11 w-11 place-items-center rounded-full text-sand transition-colors hover:bg-white/5 hover:text-cream"><IconSearch /></Link>
          <Link href={user ? "/account" : "/login"} aria-label={user ? "Your account" : "Sign in"} className="hidden h-11 items-center gap-2 rounded-full px-3 text-sm text-sand transition-colors hover:bg-white/5 hover:text-cream sm:flex">
            <IconUser />{user ? <span className="max-w-24 truncate">{user.firstName || "Account"}</span> : null}
          </Link>
          {user?.isStaff ? <Link href="/admin" className="chip-amber hidden md:inline-flex">Admin</Link> : null}
          <button onClick={() => setOpen(true)} aria-label={`Open cart, ${mounted ? count : 0} items`} className="relative grid h-11 w-11 place-items-center rounded-full text-sand transition-colors hover:bg-white/5 hover:text-cream">
            <IconCart />
            {mounted && count > 0 ? <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber px-1 text-[10px] font-bold text-void">{count}</span> : null}
          </button>
          <button onClick={() => setMenu(true)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-full text-sand hover:bg-white/5 lg:hidden"><IconMenu /></button>
        </div>
      </div>

      {/* Desktop mega menu */}
      <div className={`absolute inset-x-0 top-full hidden overflow-hidden border-b border-white/[0.07] bg-coal/95 backdrop-blur-xl transition-all duration-300 lg:block ${hover ? "visible max-h-80 opacity-100" : "invisible max-h-0 opacity-0"}`}>
        {nav.map((c) => (
          <div key={c.slug} className={`wrap grid-cols-[1fr_2.2fr] gap-12 py-9 ${hover === c.slug ? "grid" : "hidden"}`}>
            <div>
              <p className="eyebrow">{c.name}</p>
              <p className="display mt-3 text-3xl">{c.tagline}</p>
              <Link href={`/c/${c.slug}`} className="link mt-4 inline-block text-sm">Shop all {c.name.toLowerCase()}</Link>
            </div>
            <ul className="grid grid-cols-3 content-start gap-x-8 gap-y-3">
              {c.children.map((k) => <li key={k.slug}><Link href={`/c/${c.slug}/${k.slug}`} className="text-sm text-sand transition-colors hover:text-amber">{k.name}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* Mobile drawer */}
      {menu ? (
        <div className="fixed inset-0 z-[70] h-dvh overflow-y-auto bg-coal lg:hidden">
          <div className="wrap flex h-[68px] items-center justify-between">
            <Logo />
            <button onClick={() => setMenu(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-full text-sand hover:bg-white/5"><IconClose /></button>
          </div>
          <div className="wrap pb-16 pt-4">
            {nav.map((c) => (
              <details key={c.slug} className="border-b border-white/[0.07] py-1">
                <summary className="display flex min-h-14 items-center justify-between text-2xl">{c.name}<span className="text-amber">+</span></summary>
                <ul className="pb-4">
                  <li><Link href={`/c/${c.slug}`} className="block py-2.5 text-amber">All {c.name}</Link></li>
                  {c.children.map((k) => <li key={k.slug}><Link href={`/c/${c.slug}/${k.slug}`} className="block py-2.5 text-sand">{k.name}</Link></li>)}
                </ul>
              </details>
            ))}
            <div className="mt-8 grid gap-3">
              <Link href={user ? "/account" : "/login"} className="btn-ghost">{user ? "Your account" : "Sign in"}</Link>
              <Link href="/track" className="btn-ghost">Track an order</Link>
              {user?.isStaff ? <Link href="/admin" className="btn-ghost">Admin</Link> : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
