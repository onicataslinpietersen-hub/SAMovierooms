import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Catalogue, filterProducts, type CatalogueParams } from "@/components/Catalogue";
import { ProductArt } from "@/components/ProductArt";
import { SceneFilm } from "@/components/CinemaScene";
import { getCategories, loadProducts, toPublic } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<CatalogueParams> };

async function resolve(slug: string[]) {
  const cats = await getCategories();
  const top = cats.find((c) => c.slug === slug[0] && !c.parent_id);
  if (!top || slug.length > 2) return null;
  const sub = slug[1] ? cats.find((c) => c.slug === slug[1] && c.parent_id === top.id) : null;
  if (slug[1] && !sub) return null;
  return { top, sub: sub ?? null, children: cats.filter((c) => c.parent_id === top.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolve((await params).slug);
  if (!r) return {};
  const c = r.sub ?? r.top;
  return { title: c.seo_title ?? c.name, description: c.seo_description ?? c.description, alternates: { canonical: `/c/${r.top.slug}${r.sub ? "/" + r.sub.slug : ""}` } };
}

const THEME: Record<string, { bg: string; kind: string }> = {
  projectors: { bg: "radial-gradient(90% 120% at 80% 0%, #5a3212 0%, #1a110a 45%, #0b0807 100%)", kind: "projector" },
  televisions: { bg: "radial-gradient(90% 120% at 80% 0%, #3c2350 0%, #140d18 45%, #0b0807 100%)", kind: "tv" },
  "home-theatre": { bg: "radial-gradient(90% 120% at 80% 0%, #55231a 0%, #170c0a 45%, #0b0807 100%)", kind: "speakers" },
  accessories: { bg: "radial-gradient(90% 120% at 80% 0%, #4a3d18 0%, #15120a 45%, #0b0807 100%)", kind: "screen" },
};

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const r = await resolve(slug);
  if (!r) notFound();
  const { top, sub, children } = r;
  const all = (await loadProducts("published")).map(toPublic).filter((p) => (sub ? p.category.id === sub.id : p.category.id === top.id || p.category.parentSlug === top.slug));
  const products = filterProducts(all, sp);
  const theme = THEME[top.slug] ?? THEME.projectors;
  const base = `/c/${top.slug}${sub ? "/" + sub.slug : ""}`;
  const subKind = all[0]?.kind ?? theme.kind;

  return (
    <>
      <section className="relative -mt-[68px] overflow-hidden pt-[68px]" style={{ background: theme.bg }}>
        {top.slug === "televisions" ? <div className="absolute right-[6%] top-[22%] hidden aspect-video w-[30%] overflow-hidden rounded-xl border-4 border-black shadow-[0_0_120px_-20px_rgba(245,168,58,0.6)] lg:block"><SceneFilm id="cat" /></div>
          : <ProductArt kind={sub ? subKind : theme.kind} className="absolute right-[2%] top-[14%] hidden w-[38%] max-w-[520px] opacity-95 drop-shadow-[0_40px_60px_rgba(0,0,0,0.8)] lg:block" />}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-coal to-transparent" />
        <div className="wrap relative py-16 sm:py-24 lg:py-28">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs text-ash">
            <Link href="/" className="hover:text-amber">Home</Link><span>/</span>
            {sub ? <><Link href={`/c/${top.slug}`} className="hover:text-amber">{top.name}</Link><span>/</span><span className="text-sand">{sub.name}</span></> : <span className="text-sand">{top.name}</span>}
          </nav>
          <p className="eyebrow mt-8">{sub ? top.name : "Collection"}</p>
          <h1 className="display mt-4 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">{sub ? sub.name : top.name}</h1>
          <p className="lede mt-5 max-w-xl">{sub?.description || (sub ? `${sub.name} delivered across South Africa. ${top.tagline}` : top.description)}</p>
        </div>
      </section>
      <section className="wrap pb-10 pt-6">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-6 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href={`/c/${top.slug}`} className={`btn btn-sm shrink-0 border ${!sub ? "border-amber bg-amber/10 text-amber" : "border-white/12 text-sand hover:border-white/30"}`}>All {top.name.toLowerCase()}</Link>
          {children.map((c) => <Link key={c.id} href={`/c/${top.slug}/${c.slug}`} className={`btn btn-sm shrink-0 border ${sub?.id === c.id ? "border-amber bg-amber/10 text-amber" : "border-white/12 text-sand hover:border-white/30"}`}>{c.name}</Link>)}
        </div>
        <Catalogue products={products} all={all} sp={sp} action={base} showRes={top.slug === "projectors" || top.slug === "televisions"} />
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "/" }, { "@type": "ListItem", position: 2, name: top.name, item: `/c/${top.slug}` }, ...(sub ? [{ "@type": "ListItem", position: 3, name: sub.name, item: base }] : [])] }).replace(/</g, "\\u003c") }} />
    </>
  );
}
