import "server-only";
import type { PoolClient } from "pg";
import { q, q1, tx } from "./db";
import { slugify } from "./catalog";
import type { CatalogItem } from "./suppliers/types";

/**
 * Imports one supplier catalogue item as a product in status 'imported'.
 * Imported products are invisible to customers until an admin approves and publishes them.
 * Re-importing the same supplier item only refreshes the supplier offer (cost/stock).
 */
export async function importCatalogItem(supplierId: number, item: CatalogItem, isSample: boolean): Promise<{ productId: string; created: boolean }> {
  return tx(async (c: PoolClient) => {
    const existing = await q1<{ product_id: string }>(
      "SELECT v.product_id FROM supplier_products sp JOIN product_variants v ON v.id = sp.variant_id WHERE sp.supplier_id=$1 AND sp.supplier_ref = ANY($2) LIMIT 1",
      [supplierId, item.variants.map((v) => v.ref)], c);
    if (existing) {
      for (const v of item.variants) {
        await q("UPDATE supplier_products SET cost_cents=$3, stock=$4, source_currency=$5, source_amount=$6, last_synced_at=now() WHERE supplier_id=$1 AND supplier_ref=$2", [supplierId, v.ref, v.costCents, v.stock, v.sourceCurrency, v.sourceAmount], c);
      }
      return { productId: existing.product_id, created: false };
    }
    const cat = (await q1<{ id: number }>("SELECT id FROM categories WHERE slug=$1", [item.categorySlug], c)) ?? (await q1<{ id: number }>("SELECT id FROM categories WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1", [], c))!;
    let slug = slugify(item.name) || "product";
    if (await q1("SELECT 1 FROM products WHERE slug=$1", [slug], c)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const p = (await q1<{ id: string }>(
      `INSERT INTO products(slug, name, brand, category_id, short_description, description, kind, specs, is_sample, images, warranty, weight_g, length_mm, width_mm, height_mm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13,$14,$15) RETURNING id`,
      [slug, item.name, item.brand, cat.id, item.shortDescription, item.description, item.kind, JSON.stringify(item.specs), isSample, JSON.stringify(item.images), item.warranty, item.weightG, item.lengthMm, item.widthMm, item.heightMm], c))!;
    let i = 0;
    for (const v of item.variants) {
      const sku = `SAM-${slug.slice(0, 18).toUpperCase()}-${(i + 1).toString().padStart(2, "0")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const variant = (await q1<{ id: string }>("INSERT INTO product_variants(product_id, sku, name, finish_hex, sort) VALUES ($1,$2,$3,$4,$5) RETURNING id", [p.id, sku, v.name, v.finishHex ?? null, i++], c))!;
      await q("INSERT INTO supplier_products(supplier_id, variant_id, supplier_ref, cost_cents, source_currency, source_amount, stock, moq, last_synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())", [supplierId, variant.id, v.ref, v.costCents, v.sourceCurrency, v.sourceAmount, v.stock, v.moq], c);
    }
    return { productId: p.id, created: true };
  });
}
