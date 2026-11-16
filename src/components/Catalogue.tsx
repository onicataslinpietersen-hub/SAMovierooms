import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { RESOLUTION_LABEL, type ResolutionClass } from "@/lib/specs";
import { ProductCard } from "./ProductCard";

export type CatalogueParams = { sort?: string; res?: string; stock?: string; max?: string; q?: string };

const SORTS: [string, string][] = [["featured", "Featured"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["new", "Newest"], ["popular", "Best sellers"]];
const PRICE: [string, string][] = [["", "Any price"], ["2000", "Under R2 000"], ["5000", "Under R5 000"], ["10000", "Under R10 000"], ["25000", "Under R25 000"]];

export function filterProducts(products: Product[], sp: CatalogueParams): Product[] {
  let list = products;
  const term = sp.q?.trim().toLowerCase();
  if (term) list = list.filter((p) => `${p.name} ${p.brand} ${p.shortDescription} ${p.category.name} ${p.category.parentName ?? ""}`.toLowerCase().includes(term));
  if (sp.res) list = list.filter((p) => p.resClass === sp.res);
  if (sp.stock === "1") list = list.filter((p) => p.inStock);
  if (sp.max && Number(sp.max) > 0) list = list.filter((p) => p.fromCents <= Number(sp.max) * 100);
  const by: Record<string, (a: Product, b: Product) => number> = {
    "price-asc": (a, b) => a.fromCents - b.fromCents,
    "price-desc": (a, b) => b.fromCents - a.fromCents,
    new: (a, b) => +b.createdAt - +a.createdAt,
    popular: (a, b) => Number(b.bestSeller) - Number(a.bestSeller) || b.reviewCount - a.reviewCount,
    featured: (a, b) => Number(b.featured) - Number(a.featured) || Number(b.bestSeller) - Number(a.bestSeller),
  };
  return [...list].sort(by[sp.sort ?? "featured"] ?? by.featured);
}

/** Filter bar is a plain GET form: works without JavaScript, and every filtered view has a shareable URL. */
export function Catalogue({ products, all, sp, action, showRes, search }: { products: Product[]; all: Product[]; sp: CatalogueParams; action: string; showRes?: boolean; search?: boolean }) {
  const resOptions = [...new Set(all.map((p) => p.resClass))].filter((r) => RESOLUTION_LABEL[r as ResolutionClass]) as ResolutionClass[];
  const active = !!(sp.res || sp.stock || sp.max || sp.q);
  return (
    <div>
      <form action={action} className="glass sticky top-[76px] z-30 flex flex-wrap items-end gap-3 rounded-2xl p-3 sm:p-4">
        {search ? (
          <div className="min-w-[200px] flex-[2]"><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search projectors, soundbars, screens…" className="field" type="search" /></div>
        ) : null}
        {showRes && resOptions.length > 1 ? (
          <div className="min-w-[150px] flex-1"><label className="label" htmlFor="res">Resolution</label>
            <select id="res" name="res" defaultValue={sp.res ?? ""} className="field"><option value="">All resolutions</option>{resOptions.map((r) => <option key={r} value={r}>{RESOLUTION_LABEL[r]}</option>)}</select></div>
        ) : null}
        <div className="min-w-[140px] flex-1"><label className="label" htmlFor="max">Price</label>
          <select id="max" name="max" defaultValue={sp.max ?? ""} className="field">{PRICE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="min-w-[170px] flex-1"><label className="label" htmlFor="sort">Sort by</label>
          <select id="sort" name="sort" defaultValue={sp.sort ?? "featured"} className="field">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <label className="flex min-h-11 items-center gap-2 px-1 text-sm text-sand"><input type="checkbox" name="stock" value="1" defaultChecked={sp.stock === "1"} className="h-4 w-4 accent-[#f5a83a]" />In stock only</label>
        <button className="btn-primary">Apply</button>
        {active ? <Link href={action} className="btn-ghost">Clear</Link> : null}
      </form>
      <p className="mt-6 text-sm text-ash" role="status">{products.length} {products.length === 1 ? "product" : "products"}</p>
      {products.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <div className="panel mt-6 p-12 text-center"><p className="display text-2xl">Nothing matches those filters.</p><p className="mt-2 text-sm text-ash">Try widening the price range or clearing the filters.</p><Link href={action} className="btn-ghost mt-6">Clear filters</Link></div>
      )}
    </div>
  );
}
