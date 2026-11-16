import Link from "next/link";
import { zar } from "@/lib/money";
export const STATUS_LABEL: Record<string, string> = { pending_payment: "Awaiting payment", payment_failed: "Payment failed", paid: "Paid", processing: "Processing", partially_shipped: "Partially shipped", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
export function StatusChip({ status }: { status: string }) {
  const tone = ["delivered"].includes(status) ? "border-ok/40 bg-ok/10 text-ok" : ["cancelled", "payment_failed", "failed"].includes(status) ? "border-bad/40 bg-bad/10 text-bad" : ["pending_payment", "refunded", "unknown", "awaiting_manual", "cancel_requested"].includes(status) ? "border-amber/40 bg-amber/10 text-amber" : "border-white/15 text-sand";
  return <span className={`chip ${tone}`}>{STATUS_LABEL[status] ?? status.replace(/_/g, " ")}</span>;
}
export function OrderList({ orders }: { orders: { number: string; access_token: string; status: string; total_cents: number; created_at: Date; items: string }[] }) {
  if (!orders.length) return <div className="panel p-10 text-center"><p className="display text-2xl">No orders yet.</p><Link href="/shop" className="btn-primary mt-5">Start shopping</Link></div>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.number}>
          <Link href={`/order/${o.number}?t=${o.access_token}`} className="panel card-lift flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0"><p className="font-semibold">{o.number}</p><p className="mt-0.5 truncate text-sm text-ash">{o.items}</p><p className="mt-0.5 text-xs text-dim">{o.created_at.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</p></div>
            <div className="flex items-center gap-4"><StatusChip status={o.status} /><span className="font-semibold tabular-nums">{zar(o.total_cents)}</span></div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
