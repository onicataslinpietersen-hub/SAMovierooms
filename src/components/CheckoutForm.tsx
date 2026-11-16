"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useCart } from "@/store/cart";
import { PROVINCES, deliveryWindow } from "@/lib/shipping";
import type { ShipmentQuote } from "@/lib/checkout";
import { zar } from "@/lib/money";
import { placeOrder } from "@/app/actions/checkout";
import { usePricedCart } from "./CartDrawer";
import { DiscountBox } from "./CartView";
import { AutoForm } from "./AutoForm";
import { ProductArt } from "./ProductArt";
import { IconLock } from "./Icons";

type Addr = { recipient: string; phone: string; line1: string; line2: string; suburb: string; city: string; province: string; postalCode: string };
const EMPTY: Addr = { recipient: "", phone: "", line1: "", line2: "", suburb: "", city: "", province: "", postalCode: "" };

export function CheckoutForm({ email: initialEmail, signedIn, addresses, gateway }: { email: string; signedIn: boolean; addresses: (Addr & { id: string; label: string })[]; gateway: string }) {
  const router = useRouter();
  const { lines, code, clear } = useCart();
  const { cart } = usePricedCart();
  const [email, setEmail] = useState(initialEmail);
  const [addr, setAddr] = useState<Addr>(addresses[0] ?? EMPTY);
  const [quotes, setQuotes] = useState<ShipmentQuote[] | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [gatewayForm, setGatewayForm] = useState<{ action: string; fields: [string, string][] } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const set = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr({ ...addr, [k]: e.target.value });
  const destReady = !!addr.province && /^\d{4}$/.test(addr.postalCode) && addr.city.trim().length > 1;
  const linesKey = JSON.stringify(lines);

  // Re-quote delivery whenever the basket or destination changes.
  useEffect(() => {
    if (!destReady || !lines.length) { setQuotes(null); return; }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, province: addr.province, postalCode: addr.postalCode, city: addr.city }) })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { shipments: ShipmentQuote[] }) => {
          if (!alive) return;
          setQuotes(d.shipments);
          setChoice((prev) => Object.fromEntries(d.shipments.map((s) => [String(s.supplierId), s.options.find((o) => o.code === prev[String(s.supplierId)])?.code ?? s.options[0]?.code ?? ""])));
        })
        .catch(() => alive && setQuotes([]))
        .finally(() => alive && setQuoting(false));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, addr.province, addr.postalCode, addr.city, destReady]);

  const totals = useMemo(() => {
    if (!cart) return null;
    let shipping = 0, dutiesNow = 0, dutiesLater = 0, complete = !!quotes?.length;
    for (const s of quotes ?? []) {
      const o = s.options.find((x) => x.code === choice[String(s.supplierId)]);
      if (!o) { complete = false; continue; }
      shipping += o.priceCents;
      if (o.incoterm === "DDP") dutiesNow += s.importEstimate.totalCents; else dutiesLater += s.importEstimate.totalCents;
    }
    return { shipping, dutiesNow, dutiesLater, complete, total: cart.subtotalCents - cart.discountCents + shipping + dutiesNow };
  }, [cart, quotes, choice]);

  if (gatewayForm) return <div className="py-16"><AutoForm {...gatewayForm} /></div>;
  if (hydrated && !lines.length) return <div className="panel mt-10 p-12 text-center"><p className="display text-3xl">Your cart is empty.</p><Link href="/shop" className="btn-primary mt-6">Start shopping</Link></div>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!totals?.complete) { setError("Please complete your address and choose a delivery method."); return; }
    start(async () => {
      const res = await placeOrder({ email, address: addr, lines, shipping: choice, discountCode: cart?.codeDiscount ? code : null, acceptTerms: terms, expectedTotalCents: totals.total });
      if (!res.ok) { setError(res.error); return; }
      clear();
      if (res.payment.kind === "redirect") router.push(res.payment.url);
      else setGatewayForm(res.payment);
    });
  };

  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <fieldset className="panel p-6">
          <legend className="display float-left mb-5 w-full text-2xl">1 · Contact</legend>
          <div className="clear-both">
            <label className="label" htmlFor="email">Email for order updates</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            {!signedIn ? <p className="mt-2 text-xs text-ash">Have an account? <Link href="/login?next=/checkout" className="link">Sign in</Link> for saved addresses. You can also check out as a guest.</p> : null}
          </div>
        </fieldset>

        <fieldset className="panel p-6">
          <legend className="display float-left mb-5 w-full text-2xl">2 · Delivery address</legend>
          <div className="clear-both">
            {addresses.length ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {addresses.map((a) => <button type="button" key={a.id} onClick={() => setAddr(a)} className={`btn btn-sm border ${addr.line1 === a.line1 && addr.postalCode === a.postalCode ? "border-amber bg-amber/10 text-amber" : "border-white/12 text-sand"}`}>{a.label} · {a.city}</button>)}
                <button type="button" onClick={() => setAddr(EMPTY)} className="btn btn-sm border border-white/12 text-sand">New address</button>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="recipient">Full name</label><input id="recipient" required autoComplete="name" value={addr.recipient} onChange={set("recipient")} className="field" /></div>
              <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" required type="tel" autoComplete="tel" placeholder="082 123 4567" value={addr.phone} onChange={set("phone")} className="field" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="line1">Street address</label><input id="line1" required autoComplete="address-line1" value={addr.line1} onChange={set("line1")} className="field" /></div>
              <div><label className="label" htmlFor="line2">Complex / building <span className="text-dim">(optional)</span></label><input id="line2" autoComplete="address-line2" value={addr.line2} onChange={set("line2")} className="field" /></div>
              <div><label className="label" htmlFor="suburb">Suburb <span className="text-dim">(optional)</span></label><input id="suburb" value={addr.suburb} onChange={set("suburb")} className="field" /></div>
              <div><label className="label" htmlFor="city">City / town</label><input id="city" required autoComplete="address-level2" value={addr.city} onChange={set("city")} className="field" /></div>
              <div className="grid grid-cols-[1fr_110px] gap-4">
                <div><label className="label" htmlFor="province">Province</label><select id="province" required autoComplete="address-level1" value={addr.province} onChange={set("province")} className="field"><option value="">Select…</option>{PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></div>
                <div><label className="label" htmlFor="postal">Postal code</label><input id="postal" required inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="postal-code" value={addr.postalCode} onChange={set("postalCode")} className="field" /></div>
              </div>
            </div>
            <p className="mt-3 text-xs text-dim">We deliver to street addresses in South Africa. Couriers generally cannot deliver to PO boxes.</p>
          </div>
        </fieldset>

        <fieldset className="panel p-6">
          <legend className="display float-left mb-5 w-full text-2xl">3 · Delivery method</legend>
          <div className="clear-both" aria-live="polite">
            {!destReady ? <p className="text-sm text-ash">Enter your city, province and postal code to see delivery methods and estimated dates for your order.</p> : null}
            {destReady && quoting && !quotes ? <p className="text-sm text-ash">Getting delivery options for your address…</p> : null}
            {destReady && quotes && !quotes.length ? <p className="text-sm text-bad">We could not load delivery options. Please check your address or try again.</p> : null}
            {quotes?.map((s, i) => (
              <div key={s.supplierId} className={i ? "mt-6 border-t border-white/[0.07] pt-6" : ""}>
                {quotes.length > 1 ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber">Shipment {i + 1} of {quotes.length}</p> : null}
                <p className="mb-3 text-xs text-ash">{s.items.map((it) => `${it.quantity} × ${it.name}`).join(", ")}</p>
                {s.error ? <p className="text-sm text-bad">{s.error}</p> : (
                  <div role="radiogroup" aria-label="Delivery method" className="space-y-3">
                    {s.options.map((o) => {
                      const on = choice[String(s.supplierId)] === o.code;
                      return (
                        <label key={o.code} className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors ${on ? "border-amber bg-amber/[0.07]" : "border-white/12 hover:border-white/25"}`}>
                          <input type="radio" name={`ship-${s.supplierId}`} checked={on} onChange={() => setChoice({ ...choice, [String(s.supplierId)]: o.code })} className="mt-1 h-4 w-4 accent-[#f5a83a]" />
                          <span className="flex-1">
                            <span className="flex items-baseline justify-between gap-3"><span className="font-semibold">{o.label}</span><span className="font-semibold tabular-nums">{zar(o.priceCents)}</span></span>
                            <span className="mt-1 block text-sm text-sand">Estimated delivery {deliveryWindow(o).label} <span className="text-dim">· {o.minDays}–{o.maxDays} business days</span></span>
                            <span className="mt-1 block text-xs text-ash">{o.carrier}</span>
                            <span className={`mt-2 block rounded-lg px-3 py-2 text-xs leading-relaxed ${o.incoterm === "DDP" ? "bg-ok/10 text-ok" : "bg-amber/10 text-gold"}`}>
                              {o.incoterm === "DDP"
                                ? `Duties prepaid (DDP): estimated import duties & VAT of ${zar(s.importEstimate.totalCents)} are added to your order now. Nothing further to pay on delivery.`
                                : `Duties on delivery (DAP): NOT included. The courier will ask you to pay import duties & VAT — estimated ${zar(s.importEstimate.totalCents)} — before delivery.`}
                              {!s.importEstimate.dutyRateKnown ? " Estimate covers VAT only; customs duty for this category is unconfirmed and may apply." : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {quotes?.length ? <p className="mt-4 text-[11px] leading-relaxed text-dim">Delivery dates are estimates based on supplier handling, carrier transit, customs clearance and your location. They are not guaranteed.</p> : null}
          </div>
        </fieldset>
      </div>

      <aside className="h-fit space-y-5 lg:sticky lg:top-24">
        <div className="panel p-6">
          <h2 className="display text-2xl">Order summary</h2>
          <ul className="mt-4 divide-y divide-white/[0.07]">
            {cart?.lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-3 py-3">
                <span className="relative grid h-12 w-14 shrink-0 place-items-center rounded-lg bg-char"><ProductArt kind={l.kind} finish={l.finishHex} className="h-10 w-12" /><span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-smoke text-[10px] font-bold">{l.quantity}</span></span>
                <span className="min-w-0 flex-1 text-sm"><span className="block truncate">{l.name}</span>{l.variantName !== "Standard" ? <span className="text-xs text-ash">{l.variantName}</span> : null}</span>
                <span className="text-sm tabular-nums">{zar(l.lineCents)}</span>
              </li>
            ))}
          </ul>
          {cart?.problems.map((p) => <p key={p} className="mt-2 rounded-lg bg-bad/10 p-2 text-xs text-bad">{p}</p>)}
          <div className="mt-4"><DiscountBox /></div>
          <dl className="mt-5 space-y-2 border-t border-white/[0.08] pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-sand">Subtotal</dt><dd className="tabular-nums">{cart ? zar(cart.subtotalCents) : "—"}</dd></div>
            {cart?.bundleDiscounts.map((b) => <div key={b.name} className="flex justify-between text-ok"><dt>{b.name}</dt><dd>−{zar(b.amountCents)}</dd></div>)}
            {cart?.codeDiscount ? <div className="flex justify-between text-ok"><dt>Code {cart.codeDiscount.code}</dt><dd>−{zar(cart.codeDiscount.amountCents)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-sand">Delivery</dt><dd className="tabular-nums">{totals?.complete ? zar(totals.shipping) : "—"}</dd></div>
            {totals?.dutiesNow ? <div className="flex justify-between"><dt className="text-sand">Import duties & VAT (prepaid, est.)</dt><dd className="tabular-nums">{zar(totals.dutiesNow)}</dd></div> : null}
            <div className="flex items-baseline justify-between border-t border-white/[0.08] pt-3"><dt className="font-semibold">Total to pay now</dt><dd className="text-2xl font-semibold tabular-nums">{totals?.complete ? zar(totals.total, { decimals: true }) : "—"}</dd></div>
            {totals?.dutiesLater ? <div className="flex justify-between rounded-lg bg-amber/10 p-2.5 text-xs text-gold"><dt>Payable later to courier (est.)</dt><dd className="tabular-nums">{zar(totals.dutiesLater)}</dd></div> : null}
          </dl>
        </div>
        <label className="flex items-start gap-3 text-sm text-sand">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#f5a83a]" required />
          <span>I agree to the <Link href="/terms" target="_blank" className="link">Terms &amp; Conditions</Link>, <Link href="/returns-policy" target="_blank" className="link">Returns Policy</Link> and <Link href="/privacy-policy" target="_blank" className="link">Privacy Policy</Link>, and understand my order is shipped by a third-party supplier and that delivery dates are estimates.</span>
        </label>
        {error ? <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad" role="alert">{error}</p> : null}
        <button className="btn-primary min-h-14 w-full text-base" disabled={pending || !totals?.complete || !!cart?.problems.length}>
          <IconLock className="h-4 w-4" />{pending ? "Placing your order…" : totals?.complete ? `Pay ${zar(totals.total, { decimals: true })}` : "Pay securely"}
        </button>
        <p className="text-center text-xs text-dim">You will complete payment on a secure page hosted by {gateway}. SAMovierooms never sees your card details.</p>
      </aside>
    </form>
  );
}
