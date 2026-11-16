import Link from "next/link";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { ProductCard, ProductMedia, PriceTag } from "@/components/ProductCard";
import { ProductArt } from "@/components/ProductArt";
import { Projector3DLoader } from "@/components/Projector3DLoader";
import { TheatreBuilder } from "@/components/TheatreBuilder";
import { FaqList } from "@/components/Faq";
import { NewsletterForm } from "@/components/NewsletterForm";
import { SceneFilm } from "@/components/CinemaScene";
import { IconArrow, IconShield, IconSpark, IconStar, IconTruck, IconLock } from "@/components/Icons";
import { categoryTree, loadProducts, toPublic } from "@/lib/catalog";
import { FAQ } from "@/lib/faq";
import { q } from "@/lib/db";
import { hotspotsFor, shapeFor } from "@/lib/hotspots";
import { mayClaimCrystalClear4K, prettyRes } from "@/lib/specs";
import { zar } from "@/lib/money";

export const dynamic = "force-dynamic";

function SectionHead({ eyebrow, title, lede, href, cta }: { eyebrow: string; title: React.ReactNode; lede?: string; href?: string; cta?: string }) {
  return (
    <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display mt-4 text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
        {lede ? <p className="lede mt-5">{lede}</p> : null}
      </div>
      {href ? <Link href={href} className="btn-ghost shrink-0 self-start sm:self-auto">{cta} <IconArrow className="h-4 w-4" /></Link> : null}
    </Reveal>
  );
}

export default async function Home() {
  const [all, tree, reviews] = await Promise.all([
    loadProducts("published"),
    categoryTree(),
    q<{ rating: number; title: string; body: string; first_name: string; product: string; slug: string; verified_purchase: boolean }>(
      "SELECT r.rating, r.title, r.body, u.first_name, p.name AS product, p.slug, r.verified_purchase FROM reviews r JOIN users u ON u.id=r.user_id JOIN products p ON p.id=r.product_id WHERE r.status='approved' AND p.status='published' ORDER BY r.created_at DESC LIMIT 6"),
  ]);
  const products = all.map(toPublic);
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const best = products.filter((p) => p.bestSeller).slice(0, 8);
  const portable = products.filter((p) => ["portable-projectors", "outdoor-projectors", "tripods"].includes(p.category.slug));
  // The 4K showcase may only feature a product whose verified native resolution is 4K.
  const fourK = products.find((p) => p.kind.startsWith("projector") && mayClaimCrystalClear4K(p.specs, p.specsVerified) && p.inStock);
  const fourKSupported = products.find((p) => p.resClass === "4k_supported");
  const [lead, ...rest] = featured;
  const catKind: Record<string, string> = { projectors: "projector", televisions: "tv", "home-theatre": "speakers", accessories: "screen" };

  return (
    <>
      <Hero />

      {/* 2 · Featured */}
      <section id="featured" className="wrap scroll-mt-24 py-20 sm:py-28">
        <SectionHead eyebrow="Featured" title={<>Tonight&rsquo;s <em className="gold-text">headliners</em></>} lede="The pieces we would build a cinema around." href="/shop" cta="View all products" />
        <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          {lead ? (
            <Reveal>
              <Link href={`/p/${lead.slug}`} className="card-lift group relative flex h-full min-h-[460px] flex-col justify-end overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[radial-gradient(110%_80%_at_70%_10%,#3a2616_0%,#15100c_50%,#090706_100%)] p-8 sm:p-10">
                <div className="absolute right-[-8%] top-[4%] w-[78%] transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 sm:w-[66%]"><ProductMedia p={lead} className="w-full" /></div>
                <div className="relative max-w-md">
                  {lead.resClass === "native_4k" ? <span className="chip-amber">Native 4K</span> : null}
                  <h3 className="display mt-4 text-4xl sm:text-5xl">{lead.name}</h3>
                  <p className="mt-3 text-sand">{lead.shortDescription}</p>
                  <div className="mt-6 flex items-center gap-5"><PriceTag p={lead} size="lg" /><span className="btn-primary btn-sm">Discover</span></div>
                </div>
              </Link>
            </Reveal>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
            {rest.map((p, i) => (
              <Reveal key={p.id} delay={0.08 * (i + 1)}>
                <Link href={`/p/${p.slug}`} className="card-lift group flex h-full items-center gap-5 overflow-hidden rounded-3xl border border-white/[0.07] bg-soot p-5 sm:flex-col sm:items-start lg:flex-row lg:items-center">
                  <div className="grid h-24 w-32 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-char to-void"><ProductMedia p={p} className="h-20 w-28 transition-transform duration-700 group-hover:scale-110" /></div>
                  <div className="min-w-0"><p className="text-[11px] uppercase tracking-[0.18em] text-ash">{p.category.name}</p><h3 className="mt-1 font-semibold group-hover:text-amber">{p.name}</h3><div className="mt-2"><PriceTag p={p} /></div></div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3 · Shop by category */}
      <section className="border-y border-white/[0.06] bg-void py-20 sm:py-28">
        <div className="wrap">
          <SectionHead eyebrow="Shop by category" title="Every seat in the house" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tree.map((c, i) => (
              <Reveal key={c.id} delay={i * 0.07}>
                <Link href={`/c/${c.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-3xl border border-white/[0.07]">
                  <div className="absolute inset-0 transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110" style={{ background: ["radial-gradient(90% 70% at 50% 20%, #4a2a12, #120c08 70%)", "radial-gradient(90% 70% at 50% 20%, #33203c, #0e0a10 70%)", "radial-gradient(90% 70% at 50% 20%, #40201a, #100908 70%)", "radial-gradient(90% 70% at 50% 20%, #3a3016, #0f0d08 70%)"][i % 4] }} />
                  <ProductArt kind={catKind[c.slug] ?? "projector"} className="absolute inset-x-[8%] top-[10%] w-[84%] transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-2 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="display text-3xl">{c.name}</h3>
                    <p className="mt-1.5 text-sm text-sand">{c.tagline}</p>
                    <p className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">Explore <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1.5" /></p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · The 4K experience */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/10 blur-[140px]" />
        <div className="wrap relative grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">The 4K experience</p>
            <h2 className="display mt-4 text-5xl sm:text-6xl lg:text-7xl">Crystal-Clear <span className="gold-text italic">4K</span> Entertainment.</h2>
            <p className="lede mt-6 max-w-xl">Over eight million pixels, each one drawn by light. Native 4K resolves the fine detail — the weave of a costume, rain on a windscreen — that makes a picture feel like a window.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-2xl p-5">
                <span className="chip-amber">Native 4K</span>
                <p className="mt-3 text-sm leading-relaxed text-sand">A true 3840 × 2160 imaging engine. Every pixel of a 4K film reaches the screen.</p>
              </div>
              <div className="rounded-2xl border border-white/10 p-5">
                <span className="chip">4K input supported</span>
                <p className="mt-3 text-sm leading-relaxed text-sand">Accepts a 4K signal, shows it at a lower native resolution{fourKSupported?.specs.native_resolution ? ` (e.g. ${prettyRes(fourKSupported.specs.native_resolution)})` : ""}. Great value — but not the same thing, so we never call it 4K.</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/c/projectors/native-4k-projectors" className="btn-primary">Shop native 4K</Link>
              <Link href="/c/projectors/4k-compatible-projectors" className="btn-ghost">4K-compatible projectors</Link>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            {fourK ? (
              <div className="relative">
                <Projector3DLoader kind={fourK.kind} shape={shapeFor(fourK.kind)} finish={fourK.variants[0]?.finishHex ?? undefined} hotspots={hotspotsFor(fourK)} className="aspect-square w-full sm:aspect-[5/4]" />
                <Link href={`/p/${fourK.slug}`} className="glass absolute left-4 top-4 rounded-2xl px-4 py-3 transition-colors hover:border-amber/50">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber">Shown</p><p className="text-sm font-semibold">{fourK.name}</p><p className="text-xs text-sand">{zar(fourK.fromCents)}</p>
                </Link>
              </div>
            ) : <div className="aspect-video overflow-hidden rounded-3xl border border-white/10"><SceneFilm id="k" /></div>}
          </Reveal>
        </div>
      </section>

      {/* 5 · Portable cinema */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0d0b0a_0%,#141024_45%,#2a1420_78%,#0d0b0a_100%)] py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          {Array.from({ length: 40 }).map((_, i) => <span key={i} className="absolute h-px w-px rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 55}%`, opacity: 0.3 + ((i * 7) % 10) / 14, transform: `scale(${1 + (i % 3)})` }} />)}
        </div>
        <div className="wrap relative">
          <SectionHead eyebrow="Portable cinema collection" title={<>Movie night, <em className="gold-text">anywhere</em></>} lede="Battery-powered projectors and the kit to go with them. The stoep, the campsite, the bedroom ceiling." href="/c/projectors/portable-projectors" cta="Shop portable" />
        </div>
        <div className="no-scrollbar relative mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:px-8 lg:px-[max(3rem,calc((100vw-1320px)/2+3rem))]">
          {portable.map((p) => <div key={p.id} className="w-[78vw] max-w-[340px] shrink-0 snap-start"><ProductCard p={p} tall /></div>)}
        </div>
      </section>

      {/* 6 · Build your own */}
      <section id="build" className="wrap scroll-mt-24 py-20 sm:py-28">
        <SectionHead eyebrow="Build your own home theatre" title={<>Design the room. <em className="gold-text">We&rsquo;ll cast it.</em></>} lede="Choose your space, your picture and your sound. Watch the room change and get a matched setup you can add to your cart in one tap." />
        <Reveal className="mt-12">
          <TheatreBuilder products={products.map((p) => ({ slug: p.slug, name: p.name, kind: p.kind, categorySlug: p.category.slug, fromCents: p.fromCents, variantId: (p.variants.find((v) => v.inStock) ?? p.variants[0]).id, finishHex: p.variants[0]?.finishHex ?? null, inStock: p.inStock }))} />
        </Reveal>
      </section>

      {/* 7 · Best sellers */}
      <section className="border-t border-white/[0.06] bg-void py-20 sm:py-28">
        <div className="wrap">
          <SectionHead eyebrow="Best sellers" title="Crowd favourites" href="/shop?sort=popular" cta="See more" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {best.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 0.06}><ProductCard p={p} /></Reveal>)}
          </div>
        </div>
      </section>

      {/* 8 · Why SAMovierooms */}
      <section className="wrap py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <p className="eyebrow">Why shop with SAMovierooms?</p>
            <h2 className="display mt-4 text-4xl sm:text-5xl">Cinema-grade gear. <span className="text-ash">Straight talk.</span></h2>
            <p className="lede mt-5">We would rather tell you exactly what you are buying, when it should arrive and what it will cost at your door.</p>
            <Link href="/about" className="link mt-6 inline-block">How SAMovierooms works</Link>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: <IconSpark />, t: "Honest specifications", d: "Native resolution is always listed. A projector that only accepts a 4K signal is never sold as 4K." },
              { icon: <IconTruck />, t: "Transparent delivery", d: "Delivery windows are estimated per product and address, and clearly marked as estimates. Duties are disclosed before you pay." },
              { icon: <IconShield />, t: "Vetted supplier partners", d: "Orders are fulfilled directly by suppliers we approve one by one. You deal with us from order to warranty." },
              { icon: <IconLock />, t: "Secure payments in Rand", d: "Pay in ZAR through a South African payment gateway. We never see or store your card details." },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 0.07}>
                <div className="glass h-full rounded-3xl p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-amber/40 bg-amber/10 text-amber">{f.icon}</span>
                  <h3 className="mt-5 text-lg font-semibold">{f.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-sand">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 9 · Reviews */}
      <section className="border-y border-white/[0.06] bg-[radial-gradient(80%_120%_at_50%_0%,#1d140d,#0a0807)] py-20 sm:py-28">
        <div className="wrap">
          <SectionHead eyebrow="Customer reviews" title="From the front row" />
          {reviews.length ? (
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {reviews.map((r, i) => (
                <Reveal key={i} delay={(i % 3) * 0.07}>
                  <figure className="panel h-full p-7">
                    <div className="flex gap-0.5 text-amber" aria-label={`${r.rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, s) => <IconStar key={s} filled={s < r.rating} className="h-4 w-4" />)}</div>
                    <blockquote className="display mt-4 text-xl leading-snug">{r.title ? `“${r.title}”` : null}</blockquote>
                    <p className="mt-3 text-sm leading-relaxed text-sand">{r.body}</p>
                    <figcaption className="mt-5 text-xs text-ash">{r.first_name} · <Link href={`/p/${r.slug}`} className="hover:text-amber">{r.product}</Link>{r.verified_purchase ? " · Verified purchase" : ""}</figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal className="mt-12">
              <div className="panel mx-auto max-w-2xl p-10 text-center">
                <div className="flex justify-center gap-1 text-amber/40">{Array.from({ length: 5 }).map((_, s) => <IconStar key={s} filled={false} className="h-6 w-6" />)}</div>
                <p className="display mt-5 text-2xl">The first reviews are still being written.</p>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-sand">We only publish reviews from real SAMovierooms customers, and we mark the ones from verified purchases. Bought something from us? Leave a review from the product page.</p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* 10 · FAQ */}
      <section className="wrap grid gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <p className="eyebrow">Frequently asked questions</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Before the lights go down</h2>
          <p className="lede mt-5">Delivery, duties, returns and how ordering works.</p>
          <Link href="/faq" className="btn-ghost mt-7">All questions</Link>
        </Reveal>
        <Reveal delay={0.1}><FaqList items={FAQ.slice(0, 6)} /></Reveal>
      </section>

      {/* 11 · Newsletter */}
      <section className="wrap pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-amber/20 bg-[radial-gradient(120%_140%_at_0%_0%,#4a2a10_0%,#1a110a_45%,#0b0807_100%)] p-8 sm:p-14">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-amber/25 blur-[100px]" />
            <div className="relative grid items-center gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow">The SAMovierooms list</p>
                <h2 className="display mt-4 text-4xl sm:text-5xl">Premieres, before everyone else.</h2>
                <p className="lede mt-4">New arrivals, setup guides and subscriber-only offers. Use code <strong className="text-amber">WELCOME10</strong> for 10% off your first order over R1 000.</p>
              </div>
              <NewsletterForm />
            </div>
          </div>
        </Reveal>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.slice(0, 6).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }).replace(/</g, "\\u003c") }} />
    </>
  );
}
