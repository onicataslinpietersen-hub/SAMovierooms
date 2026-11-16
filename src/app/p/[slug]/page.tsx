import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductStage } from "@/components/ProductStage";
import { ProductCard } from "@/components/ProductCard";
import { ReviewForm } from "@/components/ReviewForm";
import { Reveal } from "@/components/Reveal";
import { IconInfo, IconPlug, IconShield, IconStar, IconBox } from "@/components/Icons";
import { getProductBySlug, loadProducts, toPublic } from "@/lib/catalog";
import { getUser } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { env } from "@/lib/env";
import { hotspotsFor, shapeFor } from "@/lib/hotspots";
import { getSettings } from "@/lib/settings";
import { RESOLUTION_EXPLAINER, RESOLUTION_LABEL, mayClaimCrystalClear4K, powerCompatibility, specGroups } from "@/lib/specs";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return {};
  return { title: `${p.name} — ${p.category.name} South Africa`, description: p.shortDescription, alternates: { canonical: `/p/${p.slug}` }, openGraph: { title: p.name, description: p.shortDescription, images: p.images.map((i) => i.url) } };
}

export default async function ProductPage({ params }: Props) {
  const internal = await getProductBySlug((await params).slug);
  if (!internal) notFound();
  const p = toPublic(internal);
  const [user, reviews, settings, all] = await Promise.all([
    getUser(),
    q<{ rating: number; title: string; body: string; first_name: string; verified_purchase: boolean; created_at: Date }>("SELECT r.rating, r.title, r.body, u.first_name, r.verified_purchase, r.created_at FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=$1 AND r.status='approved' ORDER BY r.created_at DESC LIMIT 30", [p.id]),
    getSettings(),
    loadProducts("published"),
  ]);
  const wished = user ? !!(await q1("SELECT 1 FROM wishlist_items WHERE user_id=$1 AND product_id=$2", [user.id, p.id])) : false;
  const related = all.filter((x) => x.id !== p.id && (x.category.id === p.category.id || x.category.parentSlug === p.category.parentSlug)).slice(0, 4).map(toPublic);
  const power = powerCompatibility(p.specs);
  const groups = specGroups(p.specs);
  const crystal = mayClaimCrystalClear4K(p.specs, p.specsVerified);
  const isDisplay = p.kind.startsWith("projector") || p.kind === "tv";
  const parent = p.category.parentSlug;

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.shortDescription, sku: p.variants[0]?.sku, category: p.category.name,
    ...(p.brand && !p.isSample ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.images.length ? { image: p.images.map((i) => i.url) } : {}),
    ...(p.reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount } } : {}),
    offers: { "@type": "AggregateOffer", priceCurrency: "ZAR", lowPrice: (p.fromCents / 100).toFixed(2), highPrice: (Math.max(...p.variants.map((v) => v.priceCents)) / 100).toFixed(2), offerCount: p.variants.length, availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${env.siteUrl}/p/${p.slug}` },
  };

  return (
    <div className="wrap py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap gap-2 text-xs text-ash">
        <Link href="/" className="hover:text-amber">Home</Link><span>/</span>
        {parent ? <><Link href={`/c/${parent}`} className="hover:text-amber">{p.category.parentName}</Link><span>/</span><Link href={`/c/${parent}/${p.category.slug}`} className="hover:text-amber">{p.category.name}</Link></> : <Link href={`/c/${p.category.slug}`} className="hover:text-amber">{p.category.name}</Link>}
      </nav>

      <ProductStage p={p} hotspots={hotspotsFor(p)} shape={shapeFor(p.kind)} wished={wished}>
        <div className="flex flex-wrap gap-2">
          {RESOLUTION_LABEL[p.resClass] && isDisplay ? <span className={p.resClass === "native_4k" ? "chip-amber" : "chip"}>{RESOLUTION_LABEL[p.resClass]}</span> : null}
          <span className="chip">{p.category.name}</span>
        </div>
        <h1 className="display mt-5 text-4xl sm:text-5xl lg:text-6xl">{p.name}</h1>
        {crystal ? <p className="gold-text mt-3 text-lg font-semibold">Crystal-Clear 4K Entertainment.</p> : null}
        <p className="lede mt-4">{p.shortDescription}</p>
        {p.reviewCount ? <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-sand hover:text-amber"><span className="flex text-amber">{Array.from({ length: 5 }).map((_, s) => <IconStar key={s} filled={s < Math.round(p.rating ?? 0)} className="h-4 w-4" />)}</span>{p.rating?.toFixed(1)} · {p.reviewCount} review{p.reviewCount > 1 ? "s" : ""}</a> : null}
        {isDisplay && RESOLUTION_EXPLAINER[p.resClass] ? (
          <p className={`mt-5 flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${p.resClass === "4k_supported" ? "border-amber/40 bg-amber/[0.07] text-cream" : "border-white/10 text-sand"}`}>
            <IconInfo className="mt-0.5 h-5 w-5 shrink-0 text-amber" /><span>{RESOLUTION_EXPLAINER[p.resClass]}</span>
          </p>
        ) : null}
      </ProductStage>

      {/* Story + specs */}
      <section className="mt-20 grid gap-12 border-t border-white/[0.07] pt-16 lg:grid-cols-[1fr_1.3fr]">
        <Reveal>
          <p className="eyebrow">The experience</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">About the {p.name}</h2>
          <p className="mt-5 whitespace-pre-line leading-relaxed text-sand">{p.description}</p>
          {p.isSample ? <p className="mt-6 rounded-2xl border border-amber/30 bg-amber/[0.06] p-4 text-sm text-sand"><strong className="text-amber">Sample listing.</strong> This is a demonstration product. Its specifications are placeholders and have not been verified against a real device.</p> : null}
        </Reveal>
        <Reveal delay={0.1}>
          <p className="eyebrow">Technical specifications</p>
          {groups.length ? groups.map((g) => (
            <div key={g.group} className="mt-6">
              <h3 className="text-sm font-semibold text-cream">{g.group}</h3>
              <dl className="mt-2 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                {g.rows.map(([k, v]) => <div key={k} className="grid grid-cols-[40%_1fr] gap-4 py-3 text-sm"><dt className="text-ash">{k}</dt><dd className="text-cream">{v}</dd></div>)}
              </dl>
            </div>
          )) : <p className="mt-4 text-sm text-ash">Detailed specifications are being confirmed with the supplier.</p>}
          <dl className="mt-6 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {p.weightG ? <div className="grid grid-cols-[40%_1fr] gap-4 py-3 text-sm"><dt className="text-ash">Shipping weight</dt><dd>{(p.weightG / 1000).toFixed(1)} kg</dd></div> : null}
            {p.lengthMm ? <div className="grid grid-cols-[40%_1fr] gap-4 py-3 text-sm"><dt className="text-ash">Packed dimensions</dt><dd>{p.lengthMm / 10} × {p.widthMm / 10} × {p.heightMm / 10} cm</dd></div> : null}
          </dl>
          {!p.specsVerified || p.isSample ? null : <p className="mt-3 text-xs text-dim">Specifications as provided by the supplier and checked by SAMovierooms.</p>}
        </Reveal>
      </section>

      {/* Trust: power, warranty, returns, fulfilment */}
      <section className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: <IconPlug />, t: "Power in South Africa", d: power.note, tone: power.ok === false ? "bad" : power.ok === null ? "warn" : "ok" },
          { icon: <IconShield />, t: "Warranty", d: `${p.warranty ? p.warranty + " " : ""}You are also covered by the Consumer Protection Act's 6-month implied warranty of quality.`, link: ["/warranty-policy", "Warranty policy"] },
          { icon: <IconBox />, t: "Returns", d: p.returnsInfo || `Change of mind: cancel within 7 days of delivery under the ECT Act cooling-off right${settings.returns_window_days > 7 ? ` (we extend this to ${settings.returns_window_days} days)` : ""}; you cover return shipping. Faulty items: repair, replacement or refund.`, link: ["/returns-policy", "Returns policy"] },
          { icon: <IconInfo />, t: "Fulfilled by our supplier", d: "This product is shipped to you directly by a third-party supplier partner. SAMovierooms remains your seller and point of contact.", link: ["/shipping-policy", "Shipping policy"] },
        ].map((c) => (
          <div key={c.t} className="panel p-6">
            <span className={`grid h-10 w-10 place-items-center rounded-full border ${c.tone === "bad" ? "border-bad/40 text-bad" : "border-amber/40 text-amber"}`}>{c.icon}</span>
            <h3 className="mt-4 font-semibold">{c.t}</h3>
            <p className={`mt-2 text-sm leading-relaxed ${c.tone === "bad" ? "text-bad" : "text-sand"}`}>{c.d}</p>
            {c.link ? <Link href={c.link[0]} className="link mt-3 inline-block text-xs">{c.link[1]}</Link> : null}
          </div>
        ))}
      </section>

      {/* Reviews */}
      <section id="reviews" className="mt-20 scroll-mt-28 grid gap-12 border-t border-white/[0.07] pt-16 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="eyebrow">Customer reviews</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">{p.reviewCount ? `${p.rating?.toFixed(1)} out of 5` : "No reviews yet"}</h2>
          <p className="mt-3 text-sm text-ash">{p.reviewCount ? `Based on ${p.reviewCount} review${p.reviewCount > 1 ? "s" : ""}.` : "Be the first to share your experience with this product."} Reviews are moderated and only published from real customers.</p>
          <div className="mt-8">{user ? <ReviewForm productId={p.id} /> : <Link href={`/login?next=/p/${p.slug}%23reviews`} className="btn-ghost">Sign in to write a review</Link>}</div>
        </div>
        <ul className="space-y-4">
          {reviews.map((r, i) => (
            <li key={i} className="panel p-6">
              <div className="flex items-center justify-between"><span className="flex text-amber" aria-label={`${r.rating} out of 5`}>{Array.from({ length: 5 }).map((_, s) => <IconStar key={s} filled={s < r.rating} className="h-4 w-4" />)}</span><time className="text-xs text-dim">{r.created_at.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</time></div>
              {r.title ? <p className="mt-3 font-semibold">{r.title}</p> : null}
              <p className="mt-2 text-sm leading-relaxed text-sand">{r.body}</p>
              <p className="mt-3 text-xs text-ash">{r.first_name}{r.verified_purchase ? " · Verified purchase" : ""}</p>
            </li>
          ))}
        </ul>
      </section>

      {related.length ? (
        <section className="mt-20 border-t border-white/[0.07] pt-16">
          <h2 className="display text-3xl sm:text-4xl">Complete the room</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{related.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </section>
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
