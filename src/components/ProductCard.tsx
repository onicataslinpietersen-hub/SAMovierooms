import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { RESOLUTION_LABEL } from "@/lib/specs";
import { zar } from "@/lib/money";
import { ProductArt } from "./ProductArt";
import { IconStar } from "./Icons";

export function ProductMedia({ p, className = "", finish }: { p: Pick<Product, "images" | "kind" | "name" | "variants">; className?: string; finish?: string | null }) {
  const img = p.images[0];
  // eslint-disable-next-line @next/next/no-img-element
  if (img) return <img src={img.url} alt={img.alt || p.name} loading="lazy" decoding="async" className={`object-contain ${className}`} />;
  return <ProductArt kind={p.kind} finish={finish ?? p.variants[0]?.finishHex} className={className} label={p.name} />;
}

export function PriceTag({ p, size = "md" }: { p: Pick<Product, "fromCents" | "regularFromCents" | "onPromo" | "variants">; size?: "md" | "lg" }) {
  const multi = new Set(p.variants.map((v) => v.priceCents)).size > 1;
  return (
    <p className={`flex items-baseline gap-2 tabular-nums ${size === "lg" ? "text-3xl" : "text-base"}`}>
      {multi ? <span className="text-xs text-ash">from</span> : null}
      <span className="font-semibold text-cream">{zar(p.fromCents)}</span>
      {p.onPromo ? <span className="text-sm text-dim line-through">{zar(p.regularFromCents)}</span> : null}
    </p>
  );
}

export function ProductCard({ p, tall }: { p: Product; tall?: boolean }) {
  const badge = RESOLUTION_LABEL[p.resClass];
  return (
    <Link href={`/p/${p.slug}`} className="card-lift group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-soot">
      <div className={`relative grid place-items-center overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#2a1f17_0%,#120e0b_55%,#0a0807_100%)] ${tall ? "aspect-[4/4.2]" : "aspect-[4/3]"}`}>
        <div className="absolute inset-x-10 bottom-0 h-24 rounded-full bg-amber/20 blur-3xl transition-opacity duration-700 group-hover:opacity-100 sm:opacity-40" />
        <ProductMedia p={p} className="relative h-[78%] w-[84%] transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07]" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          {badge ? <span className={p.resClass === "native_4k" ? "chip-amber" : "chip bg-black/40"}>{badge}</span> : null}
          {p.onPromo ? <span className="chip border-ok/40 bg-ok/10 text-ok">Offer</span> : null}
        </div>
        {!p.inStock ? <span className="chip absolute right-4 top-4 bg-black/60">Out of stock</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ash">{p.category.name}</p>
        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug transition-colors group-hover:text-amber">{p.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ash">{p.shortDescription}</p>
        <div className="mt-auto flex items-end justify-between pt-5">
          <PriceTag p={p} />
          {p.rating ? <span className="flex items-center gap-1 text-xs text-sand"><IconStar className="h-3.5 w-3.5 text-amber" />{p.rating.toFixed(1)} <span className="text-dim">({p.reviewCount})</span></span> : null}
        </div>
      </div>
    </Link>
  );
}
