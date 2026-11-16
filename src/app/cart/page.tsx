import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
export const metadata: Metadata = { title: "Your cart", robots: { index: false } };
export default function CartPage() {
  return <section className="wrap py-12 sm:py-16"><h1 className="display text-5xl sm:text-6xl">Your cart</h1><CartView /></section>;
}
