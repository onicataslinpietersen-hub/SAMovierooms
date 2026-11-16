import "server-only";
import { cache } from "react";
import { q } from "./db";
import { resolvePrice, type PricingRule } from "./pricing";
import { resolutionClass, type ResolutionClass, type Specs } from "./specs";

export type Category = { id: number; parent_id: number | null; slug: string; name: string; tagline: string; description: string; seo_title: string | null; seo_description: string | null; tariff_heading: string | null; duty_rate_bps: number; duty_verified: boolean; sort: number };

export type InternalOffer = { supplierId: number; supplierName: string; adapter: string; supplierRef: string; costCents: number; stock: number };

export type Variant = {
  id: string; sku: string; name: string; finishHex: string | null;
  priceCents: number; regularCents: number; onPromo: boolean; stock: number; inStock: boolean;
};
type InternalVariant = Variant & { offer: InternalOffer | null; priceSource: string };

export type Product = {
  id: string; slug: string; name: string; brand: string; kind: string;
  category: { id: number; slug: string; name: string; parentSlug: string | null; parentName: string | null; dutyRateBps: number; dutyVerified: boolean };
  shortDescription: string; description: string; specs: Specs; specsVerified: boolean; isSample: boolean;
  images: { url: string; alt: string }[]; videoUrl: string | null; warranty: string; returnsInfo: string;
  weightG: number; lengthMm: number; widthMm: number; heightMm: number;
  status: string; featured: boolean; bestSeller: boolean;
  variants: Variant[];
  fromCents: number; regularFromCents: number; onPromo: boolean; inStock: boolean;
  rating: number | null; reviewCount: number; resClass: ResolutionClass;
  createdAt: Date;
};
/** Server-only shape: includes supplier offers (wholesale cost). Never pass to a client component. */
export type InternalProduct = Omit<Product, "variants"> & {
  variants: InternalVariant[];
  overrideCents: number | null; promoCents: number | null; promoStarts: Date | null; promoEnds: Date | null; categoryChain: number[];
};

export function toPublic(p: InternalProduct): Product {
  const { overrideCents: _o, promoCents: _p, promoStarts: _s, promoEnds: _e, categoryChain: _c, ...rest } = p;
  return { ...rest, variants: p.variants.map(({ offer: _offer, priceSource: _ps, ...v }) => v) };
}

export const getCategories = cache(() => q<Category>("SELECT * FROM categories ORDER BY sort, name"));
export const getPricingRules = cache(() => q<PricingRule>("SELECT scope, category_id, product_id, kind, value FROM pricing_rules ORDER BY id DESC"));

/** Loads products with their variants, the winning supplier offer per variant, and resolved prices. */
export const loadProducts = cache(async (scope: "published" | "all" = "published"): Promise<InternalProduct[]> => {
  const [cats, rules, products, variants, offers, ratings] = await Promise.all([
    getCategories(),
    getPricingRules(),
    q<Record<string, never>>(`SELECT * FROM products ${scope === "published" ? "WHERE status = 'published'" : ""} ORDER BY created_at`),
    q<{ id: string; product_id: string; sku: string; name: string; finish_hex: string | null }>("SELECT * FROM product_variants ORDER BY sort"),
    q<{ variant_id: string; supplier_id: number; supplier_name: string; adapter: string; supplier_ref: string; cost_cents: number; stock: number }>(
      // Winning offer per variant: approved suppliers only; in-stock first, then supplier priority, then cost.
      `SELECT DISTINCT ON (sp.variant_id) sp.variant_id, sp.supplier_id, s.name AS supplier_name, s.adapter, sp.supplier_ref, sp.cost_cents, sp.stock
       FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id AND s.status = 'approved'
       ORDER BY sp.variant_id, (sp.stock > 0) DESC, s.priority, sp.cost_cents`),
    q<{ product_id: string; avg: string; n: string }>("SELECT product_id, avg(rating)::numeric(3,2) AS avg, count(*) AS n FROM reviews WHERE status='approved' GROUP BY product_id"),
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const offerBy = new Map(offers.map((o) => [o.variant_id, o]));
  const ratingBy = new Map(ratings.map((r) => [r.product_id, r]));
  const now = new Date();

  return (products as unknown as Record<string, unknown>[]).map((r) => {
    const p = r as Record<string, never>;
    const cat = catById.get(p.category_id)!;
    const parent = cat.parent_id ? catById.get(cat.parent_id) ?? null : null;
    const chain = [cat.id, ...(parent ? [parent.id] : [])];
    const vs: InternalVariant[] = variants.filter((v) => v.product_id === p.id).map((v) => {
      const o = offerBy.get(v.id);
      const price = resolvePrice({ costCents: o?.cost_cents ?? 0, productId: p.id, categoryChain: chain, overrideCents: p.price_override_cents, promoCents: p.promo_price_cents, promoStarts: p.promo_starts, promoEnds: p.promo_ends }, rules, now);
      const sellable = !!o && price.finalCents > 0;
      return {
        id: v.id, sku: v.sku, name: v.name, finishHex: v.finish_hex,
        priceCents: price.finalCents, regularCents: price.regularCents, onPromo: price.onPromo,
        stock: o?.stock ?? 0, inStock: sellable && (o?.stock ?? 0) > 0,
        offer: o ? { supplierId: o.supplier_id, supplierName: o.supplier_name, adapter: o.adapter, supplierRef: o.supplier_ref, costCents: o.cost_cents, stock: o.stock } : null,
        priceSource: price.source,
      };
    });
    const priced = vs.filter((v) => v.priceCents > 0);
    const cheapest = priced.sort((a, b) => a.priceCents - b.priceCents)[0];
    const rt = ratingBy.get(p.id);
    return {
      id: p.id, slug: p.slug, name: p.name, brand: p.brand, kind: p.kind,
      category: { id: cat.id, slug: cat.slug, name: cat.name, parentSlug: parent?.slug ?? null, parentName: parent?.name ?? null, dutyRateBps: cat.duty_rate_bps || parent?.duty_rate_bps || 0, dutyVerified: cat.duty_verified || (!!parent?.duty_verified && !cat.duty_rate_bps) },
      shortDescription: p.short_description, description: p.description, specs: p.specs as Specs, specsVerified: p.specs_verified, isSample: p.is_sample,
      images: p.images, videoUrl: p.video_url, warranty: p.warranty, returnsInfo: p.returns_info,
      weightG: p.weight_g, lengthMm: p.length_mm, widthMm: p.width_mm, heightMm: p.height_mm,
      status: p.status, featured: p.featured, bestSeller: p.best_seller,
      variants: vs.sort((a, b) => variants.findIndex((x) => x.id === a.id) - variants.findIndex((x) => x.id === b.id)),
      fromCents: cheapest?.priceCents ?? 0, regularFromCents: cheapest?.regularCents ?? 0, onPromo: !!cheapest?.onPromo, inStock: vs.some((v) => v.inStock),
      rating: rt ? Number(rt.avg) : null, reviewCount: rt ? Number(rt.n) : 0, resClass: resolutionClass(p.specs as Specs),
      createdAt: p.created_at,
      overrideCents: p.price_override_cents, promoCents: p.promo_price_cents, promoStarts: p.promo_starts, promoEnds: p.promo_ends, categoryChain: chain,
    } satisfies InternalProduct;
  });
});

export async function getProductBySlug(slug: string): Promise<InternalProduct | null> {
  return (await loadProducts("published")).find((p) => p.slug === slug) ?? null;
}

export type CategoryNode = Category & { children: Category[] };
export async function categoryTree(): Promise<CategoryNode[]> {
  const cats = await getCategories();
  return cats.filter((c) => !c.parent_id).map((c) => ({ ...c, children: cats.filter((x) => x.parent_id === c.id) }));
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[″"']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
