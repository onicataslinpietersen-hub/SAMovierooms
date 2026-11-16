"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Product } from "@/lib/catalog";
import { zar } from "@/lib/money";
import { useCart } from "@/store/cart";
import { toggleWishlist } from "@/app/actions/account";
import type { Hotspot } from "./Projector3D";
import { Projector3DLoader } from "./Projector3DLoader";
import { ProductArt } from "./ProductArt";
import { DeliveryEstimator } from "./DeliveryEstimator";
import { IconCheck, IconHeart } from "./Icons";

export function ProductStage({ p, hotspots, shape, wished, children }: { p: Product; hotspots: Hotspot[]; shape: "standard" | "ust" | "portable"; wished: boolean; children: React.ReactNode }) {
  const [vid, setVid] = useState((p.variants.find((v) => v.inStock) ?? p.variants[0]).id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [wish, setWish] = useState(wished);
  const [, start] = useTransition();
  const router = useRouter();
  const add = useCart((s) => s.add);
  const v = p.variants.find((x) => x.id === vid)!;
  const is3D = p.kind.startsWith("projector");
  const finishes = p.variants.length > 1;
  const [view, setView] = useState(0);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
      {/* Stage */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[radial-gradient(110%_80%_at_50%_0%,#33241a_0%,#14100c_52%,#090706_100%)]">
          <div className="pointer-events-none absolute inset-x-[15%] bottom-[6%] h-1/4 rounded-full bg-amber/25 blur-3xl" />
          {p.images.length && view > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[view - 1].url} alt={p.images[view - 1].alt || p.name} className="aspect-[5/4] w-full object-contain p-8" />
          ) : is3D ? (
            <Projector3DLoader kind={p.kind} shape={shape} finish={v.finishHex ?? undefined} hotspots={hotspots} className="aspect-[5/4] w-full" />
          ) : (
            <div className="group grid aspect-[5/4] place-items-center [perspective:1200px]">
              <ProductArt kind={p.kind} finish={v.finishHex} label={p.name} className="h-[82%] w-[86%] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:[transform:rotateY(-10deg)_rotateX(4deg)_scale(1.05)]" />
            </div>
          )}
          {p.isSample ? <span className="chip absolute left-4 top-4 bg-black/60">Sample listing</span> : null}
        </div>
        {p.images.length ? (
          <div className="mt-3 flex gap-2">
            <button onClick={() => setView(0)} aria-pressed={view === 0} className={`h-16 w-20 rounded-xl border text-[10px] uppercase tracking-widest ${view === 0 ? "border-amber text-amber" : "border-white/12 text-ash"}`}>{is3D ? "3D" : "Art"}</button>
            {p.images.map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <button key={im.url} onClick={() => setView(i + 1)} aria-label={`Image ${i + 1}`} aria-pressed={view === i + 1} className={`h-16 w-20 overflow-hidden rounded-xl border bg-soot ${view === i + 1 ? "border-amber" : "border-white/12"}`}><img src={im.url} alt="" loading="lazy" className="h-full w-full object-contain" /></button>
            ))}
          </div>
        ) : null}
        {p.videoUrl ? <video src={p.videoUrl} controls preload="none" className="mt-4 w-full rounded-2xl border border-white/10" /> : null}
      </div>

      {/* Buy box */}
      <div>
        {children}
        <div className="mt-7 flex items-baseline gap-3">
          <p className="text-4xl font-semibold tabular-nums">{zar(v.priceCents)}</p>
          {v.onPromo ? <><p className="text-lg text-dim line-through tabular-nums">{zar(v.regularCents)}</p><span className="chip border-ok/40 bg-ok/10 text-ok">Save {zar(v.regularCents - v.priceCents)}</span></> : null}
        </div>
        <p className="mt-1 text-xs text-ash">Price in ZAR. Delivery and any import duties are shown before you pay.</p>

        {finishes ? (
          <fieldset className="mt-7">
            <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-ash">{p.variants.some((x) => x.finishHex && x.finishHex !== p.variants[0].finishHex) ? "Finish" : "Option"} — <span className="text-cream">{v.name}</span></legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.variants.map((x) => (
                <button key={x.id} onClick={() => { setVid(x.id); setAdded(false); }} aria-pressed={x.id === vid} disabled={!x.inStock}
                  className={`flex min-h-11 items-center gap-2.5 rounded-full border px-4 text-sm transition-all disabled:opacity-40 ${x.id === vid ? "border-amber bg-amber/10" : "border-white/12 hover:border-white/30"}`}>
                  {x.finishHex ? <span className="h-5 w-5 rounded-full border border-white/25" style={{ background: x.finishHex }} /> : null}{x.name}{!x.inStock ? " · sold out" : ""}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <p className={`mt-6 flex items-center gap-2 text-sm ${v.inStock ? "text-ok" : "text-bad"}`}>
          <span className={`h-2 w-2 rounded-full ${v.inStock ? "bg-ok" : "bg-bad"}`} />
          {v.inStock ? (v.stock <= 5 ? `Only ${v.stock} available from our supplier` : "In stock with our supplier") : "Currently out of stock"}
        </p>

        <div className="mt-5 flex gap-3">
          <div className="flex items-center rounded-full border border-white/12">
            <button aria-label="Decrease quantity" className="grid h-12 w-11 place-items-center text-sand hover:text-amber" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-6 text-center tabular-nums" aria-live="polite">{qty}</span>
            <button aria-label="Increase quantity" className="grid h-12 w-11 place-items-center text-sand hover:text-amber" onClick={() => setQty(Math.min(Math.min(10, v.stock), qty + 1))}>+</button>
          </div>
          <button className="btn-primary min-h-12 flex-1" disabled={!v.inStock} onClick={() => { add(v.id, qty); setAdded(true); }}>
            {added ? <><IconCheck className="h-4 w-4" /> Added to cart</> : v.inStock ? "Add to cart" : "Out of stock"}
          </button>
          <button aria-label={wish ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wish} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-colors ${wish ? "border-amber text-amber" : "border-white/12 text-sand hover:border-amber hover:text-amber"}`}
            onClick={() => start(async () => { const r = await toggleWishlist(p.id); if (r.login) router.push(`/login?next=/p/${p.slug}`); else if (r.ok) setWish(!!r.on); })}>
            <IconHeart filled={wish} />
          </button>
        </div>
        {added ? <Link href="/checkout" className="btn-ghost mt-3 w-full">Go to checkout</Link> : null}

        <div className="mt-7"><DeliveryEstimator variantId={v.id} /></div>
      </div>
    </div>
  );
}
