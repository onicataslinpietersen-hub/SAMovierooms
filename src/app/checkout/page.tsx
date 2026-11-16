import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function Checkout() {
  const user = await getUser();
  const addresses = user ? await q<{ id: string; label: string; recipient: string; phone: string; line1: string; line2: string | null; suburb: string | null; city: string; province: string; postal_code: string; is_default: boolean }>("SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC", [user.id]) : [];
  return (
    <section className="wrap py-10 sm:py-14">
      <h1 className="display text-4xl sm:text-5xl">Checkout</h1>
      <CheckoutForm
        email={user?.email ?? ""}
        signedIn={!!user}
        gateway={env.paymentProvider === "payfast" ? "PayFast" : "Sandbox gateway (demo)"}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", suburb: a.suburb ?? "", city: a.city, province: a.province, postalCode: a.postal_code }))}
      />
    </section>
  );
}
