import type { Metadata } from "next";
import { Catalogue, filterProducts, type CatalogueParams } from "@/components/Catalogue";
import { loadProducts, toPublic } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop all home cinema products", description: "Browse every projector, television, home theatre system and accessory at SAMovierooms. Delivered across South Africa.", alternates: { canonical: "/shop" } };

export default async function Shop({ searchParams }: { searchParams: Promise<CatalogueParams> }) {
  const sp = await searchParams;
  const all = (await loadProducts("published")).map(toPublic);
  return (
    <section className="wrap py-12 sm:py-16">
      <p className="eyebrow">The collection</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">{sp.q ? <>Results for “{sp.q}”</> : "Shop everything"}</h1>
      <p className="lede mt-4 max-w-xl">Projectors, televisions, sound and the finishing touches.</p>
      <div className="mt-10"><Catalogue products={filterProducts(all, sp)} all={all} sp={sp} action="/shop" showRes search /></div>
    </section>
  );
}
