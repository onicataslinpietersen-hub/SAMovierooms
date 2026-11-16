"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/store/cart";
import { zar } from "@/lib/money";
import { CartLines, usePricedCart } from "./CartDrawer";

export function DiscountBox() {
  const { code, setCode } = useCart();
  const { cart } = usePricedCart();
  const [draft, setDraft] = useState(code);
  return (
    <div>
      <label className="label" htmlFor="code">Discount code</label>
      <div className="flex gap-2">
        <input id="code" value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} className="field" placeholder="e.g. WELCOME10" />
        <button type="button" className="btn-ghost shrink-0" onClick={() => setCode(draft.trim())}>Apply</button>
      </div>
      {code && cart?.codeError ? <p className="mt-2 text-xs text-bad" role="alert">{cart.codeError}</p> : null}
      {cart?.codeDiscount ? <p className="mt-2 text-xs text-ok" role="status">Code {cart.codeDiscount.code} applied. <button type="button" className="underline" onClick={() => { setCode(""); setDraft(""); }}>Remove</button></p> : null}
    </div>
  );
}

export function CartView() {
  const lines = useCart((s) => s.lines);
  const { cart, loading } = usePricedCart();
  if (!lines.length) return <div className="panel mt-10 p-12 text-center"><p className="display text-3xl">Your cart is empty.</p><p className="mt-2 text-ash">Find the centrepiece of your cinema.</p><Link href="/shop" className="btn-primary mt-6">Start shopping</Link></div>;
  if (!cart) return <p className="mt-10 text-ash">{loading ? "Loading your cart…" : ""}</p>;
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div>
        {cart.problems.map((p) => <p key={p} className="mb-3 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{p}</p>)}
        <CartLines cart={cart} />
      </div>
      <aside className="panel h-fit p-6 lg:sticky lg:top-24">
        <h2 className="display text-2xl">Summary</h2>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-sand">Subtotal</dt><dd className="tabular-nums">{zar(cart.subtotalCents)}</dd></div>
          {cart.bundleDiscounts.map((b) => <div key={b.name} className="flex justify-between text-ok"><dt>{b.name}</dt><dd>−{zar(b.amountCents)}</dd></div>)}
          {cart.codeDiscount ? <div className="flex justify-between text-ok"><dt>Code {cart.codeDiscount.code}</dt><dd>−{zar(cart.codeDiscount.amountCents)}</dd></div> : null}
          <div className="flex justify-between text-ash"><dt>Delivery & import duties</dt><dd>Calculated at checkout</dd></div>
        </dl>
        <div className="my-5 border-t border-white/[0.08]" />
        <DiscountBox />
        <Link href="/checkout" className="btn-primary mt-6 w-full">Checkout · {zar(cart.subtotalCents - cart.discountCents)}</Link>
        <p className="mt-3 text-center text-xs text-dim">Secure payment in ZAR. Card details never touch our servers.</p>
      </aside>
    </div>
  );
}
