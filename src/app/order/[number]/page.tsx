import { notFound } from "next/navigation";
import { OrderView } from "@/components/OrderView";
import { AutoRefresh } from "@/components/AutoRefresh";
import { retryPayment } from "@/app/actions/checkout";
import { getUser } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { getOrderBundle } from "@/lib/orders";

export const metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const b = await getOrderBundle({ number });
  if (!b) notFound();
  const user = await getUser();
  // Access: the order's secret link, its owner, or staff. Anything else gets a 404 (no order-number probing).
  const allowed = (t && safeEqual(b.order.access_token, t)) || (user && (user.id === b.order.user_id || user.role !== "customer"));
  if (!allowed) notFound();
  const moving = !["delivered", "cancelled", "refunded"].includes(b.order.status);
  const retry = (
    <form action={retryPayment} className="mt-3"><input type="hidden" name="number" value={b.order.number} /><input type="hidden" name="token" value={b.order.access_token} /><button className="btn-primary btn-sm">Pay now</button></form>
  );
  return (
    <section className="wrap py-10 sm:py-14">
      {moving ? <AutoRefresh /> : null}
      <p className="eyebrow">Order {b.order.number}</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">{b.order.status === "delivered" ? "Delivered. Lights down." : b.order.paid_at ? "Thank you — your order is confirmed." : "Your order"}</h1>
      <p className="mt-3 text-sm text-ash">Placed {b.order.created_at.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })} · Updates are sent to {b.order.email}</p>
      <div className="mt-8"><OrderView b={b} token={b.order.access_token} retry={retry} /></div>
    </section>
  );
}
