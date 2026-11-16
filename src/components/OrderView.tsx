import Link from "next/link";
import type { getOrderBundle } from "@/lib/orders";
import { addBusinessDays } from "@/lib/shipping";
import { zar } from "@/lib/money";
import { ProductArt } from "./ProductArt";
import { IconCheck } from "./Icons";

type Bundle = NonNullable<Awaited<ReturnType<typeof getOrderBundle>>>;

const STEPS: { key: string; label: string; hint: string }[] = [
  { key: "order_received", label: "Order received", hint: "We have your order" },
  { key: "payment_confirmed", label: "Payment confirmed", hint: "Payment cleared by the gateway" },
  { key: "processing", label: "Processing", hint: "Being prepared for our supplier" },
  { key: "supplier_submitted", label: "Supplier fulfilment", hint: "Supplier has accepted the order" },
  { key: "shipped", label: "Shipped", hint: "Handed to the carrier" },
  { key: "in_transit", label: "In transit", hint: "On its way to you" },
  { key: "out_for_delivery", label: "Out for delivery", hint: "With the delivery driver" },
  { key: "delivered", label: "Delivered", hint: "Enjoy the show" },
];
const RANK: Record<string, number> = { submitted: 3, confirmed: 3, shipped: 4, in_transit: 5, out_for_delivery: 6, delivered: 7 };
const fmt = (d: Date) => d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (d: Date) => d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

/**
 * How far the order has verifiably progressed. Each step is backed by a recorded fact:
 * steps 0–2 by our own records (order row, gateway confirmation), steps 3+ by the supplier's/carrier's reported status.
 * With several shipments the order is only as far along as its slowest shipment.
 * In transit / out for delivery are only shown as reached if the carrier reported them (or reported a later stage).
 */
function progress(b: Bundle): number {
  const paid = !!b.order.paid_at;
  if (!paid) return 0;
  const live = b.fulfillments.filter((f) => f.status !== "cancelled");
  if (!live.length) return 2;
  return Math.max(2, Math.min(...live.map((f) => RANK[f.status] ?? 2)));
}

export function OrderView({ b, token, retry }: { b: Bundle; token: string; retry?: React.ReactNode }) {
  const { order, items, fulfillments, events, tracking } = b;
  const reached = progress(b);
  const dead = ["cancelled", "refunded"].includes(order.status);
  const when = (key: string) => events.find((e) => !e.internal && e.kind === key)?.created_at;
  const paidAt = order.paid_at ?? order.created_at;

  return (
    <div>
      {order.status === "pending_payment" ? <Banner tone="warn" title="Awaiting payment">We have saved your order but have not received payment yet. Nothing has been sent to our supplier.{retry}</Banner> : null}
      {order.status === "payment_failed" ? <Banner tone="bad" title="Payment was not completed">Your payment was declined or cancelled, so the order has not been placed with our supplier. You have not been charged.{retry}</Banner> : null}
      {order.status === "cancelled" ? <Banner tone="bad" title="Order cancelled">This order has been cancelled.{order.refunded_cents ? ` ${zar(order.refunded_cents, { decimals: true })} has been refunded.` : ""}</Banner> : null}
      {order.status === "refunded" ? <Banner tone="warn" title="Order refunded">{zar(order.refunded_cents, { decimals: true })} has been refunded to your original payment method.</Banner> : null}

      {!dead ? (
        <ol className="panel grid gap-0 overflow-hidden p-6 sm:p-8 lg:grid-cols-8" aria-label="Order progress">
          {STEPS.map((s, i) => {
            const done = i <= reached && (i === 0 || !!order.paid_at), current = i === reached && !!order.paid_at && i < 7;
            const at = i === 2 ? order.paid_at : when(s.key);
            return (
              <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0 lg:flex-col lg:gap-3 lg:pb-0 lg:pr-3" aria-current={current ? "step" : undefined}>
                {i < 7 ? <span className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px lg:left-8 lg:top-[15px] lg:h-px lg:w-[calc(100%-2rem)] ${i < reached ? "bg-amber" : "bg-white/12"}`} /> : null}
                <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold ${done ? "border-amber bg-amber text-void" : "border-white/15 bg-soot text-dim"} ${current ? "shadow-[0_0_0_6px_rgba(245,168,58,0.18)]" : ""}`}>{done ? <IconCheck className="h-4 w-4" /> : i + 1}</span>
                <span>
                  <span className={`block text-sm font-semibold ${done ? "text-cream" : "text-dim"}`}>{s.label}</span>
                  <span className="block text-xs text-ash">{done && at ? fmt(at) : done ? "" : s.hint}</span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {!dead && order.paid_at ? <p className="mt-3 text-xs text-dim">Each step appears only once it has been confirmed by our payment gateway, our supplier or the carrier.</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {fulfillments.map((f, i) => {
            const its = items.filter((x) => x.fulfillment_id === f.id);
            const evs = tracking.filter((t) => t.fulfillment_id === f.id);
            const eta = f.eta_min_days && f.eta_max_days ? `${day(addBusinessDays(paidAt, f.eta_min_days))} – ${day(addBusinessDays(paidAt, f.eta_max_days))}` : null;
            return (
              <section key={f.id} className="panel p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{fulfillments.length > 1 ? `Shipment ${i + 1} of ${fulfillments.length}` : "Your shipment"}</p>
                    <p className="mt-2 text-sm text-sand">{f.shipping_carrier ?? "Carrier to be confirmed"}</p>
                  </div>
                  {f.status === "delivered" ? <span className="chip border-ok/40 bg-ok/10 text-ok">Delivered {f.delivered_at ? day(f.delivered_at) : ""}</span>
                    : f.status === "cancelled" ? <span className="chip border-bad/40 text-bad">Cancelled</span>
                    : eta && order.paid_at ? <div className="text-right"><p className="text-xs text-ash">Estimated delivery</p><p className="font-semibold">{eta}</p><p className="text-[11px] text-dim">Estimate — not guaranteed</p></div> : null}
                </div>
                <ul className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                  {its.map((it) => (
                    <li key={it.id} className="flex items-center gap-4 py-3">
                      <span className="grid h-14 w-16 shrink-0 place-items-center rounded-lg bg-char"><ProductArt kind={it.kind ?? "projector"} className="h-11 w-14" /></span>
                      <span className="min-w-0 flex-1 text-sm">{it.slug ? <Link href={`/p/${it.slug}`} className="block truncate font-medium hover:text-amber">{it.name}</Link> : <span className="block truncate font-medium">{it.name}</span>}<span className="text-xs text-ash">{it.variant_name !== "Standard" ? `${it.variant_name} · ` : ""}Qty {it.quantity}</span></span>
                      <span className="text-sm tabular-nums">{zar(it.unit_price_cents * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {f.tracking_number ? (
                  <p className="mt-4 text-sm">Tracking number: <span className="font-mono text-amber">{f.tracking_number}</span>{f.tracking_url ? <> · <a href={f.tracking_url} target="_blank" rel="noopener noreferrer" className="link">Track with carrier</a></> : null}</p>
                ) : order.paid_at && f.status !== "cancelled" ? <p className="mt-4 text-sm text-ash">A tracking number will appear here as soon as the supplier ships your parcel.</p> : null}
                {f.incoterm === "DAP" && order.paid_at && !["delivered", "cancelled"].includes(f.status) ? <p className="mt-3 rounded-lg bg-amber/10 p-3 text-xs leading-relaxed text-gold">Duties on delivery: the courier will contact you to pay import duties &amp; VAT (estimated {zar(f.duties_estimate_cents)}) before delivering this shipment.</p> : null}
                {evs.length ? (
                  <ol className="mt-5 space-y-4 border-l border-white/12 pl-5">
                    {evs.map((e, k) => (
                      <li key={k} className="relative">
                        <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${k === 0 ? "bg-amber shadow-[0_0_0_4px_rgba(245,168,58,0.2)]" : "bg-smoke"}`} />
                        <p className={`text-sm ${k === 0 ? "font-semibold" : "text-sand"}`}>{e.description}</p>
                        <p className="text-xs text-ash">{fmt(e.occurred_at)}{e.location ? ` · ${e.location}` : ""}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            );
          })}
        </div>

        <aside className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-semibold">Payment summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-sand">Subtotal</dt><dd className="tabular-nums">{zar(order.subtotal_cents)}</dd></div>
              {order.discount_cents ? <div className="flex justify-between text-ok"><dt>Discounts{order.discount_code ? ` (${order.discount_code})` : ""}</dt><dd>−{zar(order.discount_cents)}</dd></div> : null}
              <div className="flex justify-between"><dt className="text-sand">Delivery</dt><dd className="tabular-nums">{zar(order.shipping_cents)}</dd></div>
              {order.duties_collected_cents ? <div className="flex justify-between"><dt className="text-sand">Import duties & VAT (prepaid)</dt><dd className="tabular-nums">{zar(order.duties_collected_cents)}</dd></div> : null}
              <div className="flex justify-between border-t border-white/[0.08] pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{zar(order.total_cents, { decimals: true })}</dd></div>
              {order.refunded_cents ? <div className="flex justify-between text-gold"><dt>Refunded</dt><dd>−{zar(order.refunded_cents, { decimals: true })}</dd></div> : null}
            </dl>
          </section>
          <section className="panel p-6 text-sm">
            <h2 className="font-semibold">Delivering to</h2>
            <address className="mt-3 not-italic leading-relaxed text-sand">{order.ship_recipient}<br />{order.ship_line1}{order.ship_line2 ? <><br />{order.ship_line2}</> : null}{order.ship_suburb ? <><br />{order.ship_suburb}</> : null}<br />{order.ship_city}, {order.ship_province} {order.ship_postal_code}<br />{order.ship_phone}</address>
          </section>
          <section className="panel p-6 text-sm">
            <h2 className="font-semibold">Need help with this order?</h2>
            <p className="mt-2 text-sand">Questions about delivery, returns or a fault — we are your point of contact, not the supplier.</p>
            <Link href={`/contact?order=${order.number}`} className="btn-ghost btn-sm mt-4">Contact support</Link>
          </section>
          <p className="break-all text-[11px] text-dim">Bookmark this page to track your order: /order/{order.number}?t={token.slice(0, 6)}…</p>
        </aside>
      </div>
    </div>
  );
}

function Banner({ tone, title, children }: { tone: "warn" | "bad"; title: string; children: React.ReactNode }) {
  return <div className={`mb-6 rounded-2xl border p-5 ${tone === "bad" ? "border-bad/40 bg-bad/10" : "border-amber/40 bg-amber/10"}`} role="status"><p className="font-semibold">{title}</p><div className="mt-1 text-sm text-sand">{children}</div></div>;
}
