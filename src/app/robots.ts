import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const site = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  // A demo store must never be indexed.
  if (process.env.DEMO_MODE === "true") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/cart", "/order", "/api"] }, sitemap: `${site}/sitemap.xml` };
}
