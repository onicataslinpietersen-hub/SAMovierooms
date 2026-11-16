import { OrderList } from "@/components/OrderList";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
export default async function Orders() {
  const u = await requireUser("/account/orders");
  const orders = await q<{ number: string; access_token: string; status: string; total_cents: number; created_at: Date; items: string }>(`SELECT o.number, o.access_token, o.status, o.total_cents, o.created_at, (SELECT string_agg(i.name, ', ') FROM order_items i WHERE i.order_id=o.id) AS items FROM orders o WHERE o.user_id=$1 ORDER BY o.created_at DESC`, [u.id]);
  return <section><h2 className="display mb-4 text-2xl">Order history</h2><OrderList orders={orders} /></section>;
}
