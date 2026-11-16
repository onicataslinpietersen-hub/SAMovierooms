import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { Consent } from "@/components/Consent";
import { HideOnAdmin } from "@/components/HideOnAdmin";
import { getUser } from "@/lib/auth";
import { categoryTree } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: { default: "SAMovierooms — Bring the Cinema Home | Projectors & Home Theatre South Africa", template: "%s | SAMovierooms" },
  description: "Buy 4K projectors, portable projectors, televisions and home theatre systems in South Africa. Transform any room into your personal cinema with SAMovierooms.",
  keywords: ["4K projectors South Africa", "portable projectors South Africa", "home theatre systems South Africa", "smart projectors", "home cinema setup", "4K home cinema"],
  openGraph: { type: "website", siteName: "SAMovierooms", locale: "en_ZA", title: "SAMovierooms — Bring the Cinema Home", description: "Premium projectors, televisions and home theatre for South African homes." },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = { themeColor: "#0d0b0a", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, tree, settings] = await Promise.all([getUser(), categoryTree(), getSettings()]);
  const nav = tree.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline, children: c.children.map((k) => ({ slug: k.slug, name: k.name })) }));
  return (
    <html lang="en-ZA">
      <body className="grain min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-amber focus:px-4 focus:py-2 focus:text-void">Skip to content</a>
        {env.demoMode ? (
          <div className="relative z-[55] bg-amber px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide text-void" data-demo-ribbon>
            DEMO STORE — sample products with placeholder specifications. Payments and supplier orders are simulated; nothing is charged or shipped.
          </div>
        ) : null}
        <Header nav={nav} user={user ? { firstName: user.first_name, isStaff: user.role !== "customer" } : null} />
        <main id="main">{children}</main>
        <HideOnAdmin><Footer nav={nav} settings={settings} demo={env.demoMode} /></HideOnAdmin>
        <CartDrawer />
        <Consent />
      </body>
    </html>
  );
}
