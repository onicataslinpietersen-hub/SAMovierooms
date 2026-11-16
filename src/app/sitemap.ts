import type { MetadataRoute } from "next";
import { categoryTree, loadProducts } from "@/lib/catalog";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tree, products] = await Promise.all([categoryTree(), loadProducts("published")]);
  const u = (p: string) => env.siteUrl + p;
  return [
    { url: u("/"), changeFrequency: "daily", priority: 1 },
    { url: u("/shop"), changeFrequency: "daily", priority: 0.8 },
    ...tree.flatMap((c) => [{ url: u(`/c/${c.slug}`), changeFrequency: "daily" as const, priority: 0.9 }, ...c.children.map((k) => ({ url: u(`/c/${c.slug}/${k.slug}`), changeFrequency: "weekly" as const, priority: 0.7 }))]),
    ...products.map((p) => ({ url: u(`/p/${p.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...["/about", "/contact", "/faq", "/shipping-policy", "/returns-policy", "/warranty-policy", "/privacy-policy", "/terms"].map((p) => ({ url: u(p), changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
