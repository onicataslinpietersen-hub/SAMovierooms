"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";
import { zar } from "@/lib/money";
import type { PricedCart } from "@/lib/checkout";
import { ProductArt } from "./ProductArt";
import { IconClose } from "./Icons";

export function usePricedCart() {
  const lines = useCart((s) => s.lines);
  const code = useCart((s) => s.code);
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(lines) + code;
  useEffect(() => {
    if (!lines.length) { setCart(null); return; }
    let alive = true;
    setLoading(true);
    fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, code }) })
      .then((r) => r.json())
      .then((c: PricedCart) => { if (alive && c.lines) setCart(c); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { cart, loading };
}

export function CartLines({ cart, compact }: { cart: PricedCart; compact?: boolean }) {
  const { setQty, remove } = useCart();
  return (
    <ul className="divide-y divide-white/[0.07]">
      {cart.lines.map((l) => (
        <li key={l.variantId} className="flex gap-4 py-4">
          <Link href={`/p/${l.slug}`} className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-char to-void">
            <ProductArt kind={l.kind} finish={l.finishHex} className="h-16 w-20" label={l.name} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/p/${l.slug}`} className="block truncate text-sm font-semibold hover:text-amber">{l.name}</Link>
            {l.variantName !== "Standard" ? <p className="text-xs text-ash">{l.variantName}</p> : null}
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center rounded-full border border-white/12">
                <button aria-label="Decrease quantity" className="grid h-9 w-9 place-items-center text-sand hover:text-amber" onClick={() => setQty(l.variantId, l.quantity - 1)}>−</button>
                <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                <button aria-label="Increase quantity" disabled={l.quantity >= l.maxQty} className="grid h-9 w-9 place-items-center text-sand hover:text-amber disabled:opacity-30" onClick={() => setQty(l.variantId, l.quantity + 1)}>+</button>
              </div>
              <p className="text-sm font-semibold tabular-nums">{zar(l.lineCents)}</p>
            </div>
            {!compact ? <button className="mt-1 text-xs text-dim underline-offset-2 hover:text-bad hover:underline" onClick={() => remove(l.variantId)}>Remove</button> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CartDrawer() {
  const { open, setOpen, lines } = useCart();
  const { cart, loading } = usePricedCart();
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path, setOpen]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [setOpen]);
  if (path.startsWith("/admin")) return null;
  return (
    <div className={`fixed inset-0 z-[80] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
      <aside role="dialog" aria-label="Shopping cart" className={`absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col border-l border-white/[0.08] bg-soot shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <h2 className="display text-2xl">Your cart</h2>
          <button onClick={() => setOpen(false)} aria-label="Close cart" className="grid h-11 w-11 place-items-center rounded-full text-sand hover:bg-white/5"><IconClose /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6">
          {!lines.length ? (
            <div className="grid h-full place-items-center text-center">
              <div><p className="display text-2xl">The screen is dark.</p><p className="mt-2 text-sm text-ash">Your cart is empty — let&rsquo;s find your cinema.</p><Link href="/c/projectors" className="btn-primary mt-6">Explore projectors</Link></div>
            </div>
          ) : cart ? (
            <>
              {cart.problems.map((p) => <p key={p} className="mt-4 rounded-xl border border-bad/30 bg-bad/10 p-3 text-xs text-bad">{p}</p>)}
              <CartLines cart={cart} />
            </>
          ) : <p className="py-10 text-center text-sm text-ash">{loading ? "Loading your cart…" : ""}</p>}
        </div>
        {cart && cart.lines.length ? (
          <div className="border-t border-white/[0.07] p-6">
            {cart.bundleDiscounts.map((b) => <div key={b.name} className="mb-1 flex justify-between text-sm text-ok"><span>{b.name}</span><span>−{zar(b.amountCents)}</span></div>)}
            <div className="flex items-baseline justify-between"><span className="text-sm text-sand">Subtotal</span><span className="text-xl font-semibold tabular-nums">{zar(cart.subtotalCents - cart.bundleDiscounts.reduce((s, b) => s + b.amountCents, 0))}</span></div>
            <p className="mt-1 text-xs text-ash">Delivery and any import duties are calculated at checkout for your address.</p>
            <Link href="/checkout" className="btn-primary mt-4 w-full">Checkout</Link>
            <Link href="/cart" className="mt-3 block text-center text-xs text-ash underline-offset-4 hover:text-cream hover:underline">View full cart</Link>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
