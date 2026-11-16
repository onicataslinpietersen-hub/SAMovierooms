import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { requireUser } from "@/lib/auth";
import { loadProducts, toPublic } from "@/lib/catalog";
import { q } from "@/lib/db";
export default async function Wishlist() {
  const u = await requireUser("/account/wishlist");
  const ids = (await q<{ product_id: string }>("SELECT product_id FROM wishlist_items WHERE user_id=$1 ORDER BY created_at DESC", [u.id])).map((r) => r.product_id);
  const products = (await loadProducts("published")).filter((p) => ids.includes(p.id)).map(toPublic);
  return <section><h2 className="display mb-4 text-2xl">Wishlist</h2>{products.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div> : <div className="panel p-10 text-center"><p className="display text-2xl">Nothing saved yet.</p><p className="mt-2 text-sm text-ash">Tap the heart on any product to keep it here.</p><Link href="/shop" className="btn-primary mt-5">Browse products</Link></div>}</section>;
}
