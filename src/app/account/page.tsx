import Link from "next/link";
import { OrderList } from "@/components/OrderList";
import { ProfileForm } from "@/components/SimpleForms";
import { requireUser } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
export default async function Account() {
  const u = await requireUser();
  const orders = await q<{ number: string; access_token: string; status: string; total_cents: number; created_at: Date; items: string }>(`SELECT o.number, o.access_token, o.status, o.total_cents, o.created_at, (SELECT string_agg(i.name, ', ') FROM order_items i WHERE i.order_id=o.id) AS items FROM orders o WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 3`, [u.id]);
  const m = await q1<{ marketing_opt_in: boolean }>("SELECT marketing_opt_in FROM users WHERE id=$1", [u.id]);
  return (
    <div className="space-y-10">
      <section><div className="mb-4 flex items-end justify-between"><h2 className="display text-2xl">Recent orders</h2><Link href="/account/orders" className="link text-sm">All orders</Link></div><OrderList orders={orders} /></section>
      <section className="panel p-6"><h2 className="display mb-5 text-2xl">Your details</h2><p className="mb-4 text-sm text-ash">{u.email}</p><ProfileForm u={{ firstName: u.first_name, lastName: u.last_name, phone: u.phone ?? "", marketing: !!m?.marketing_opt_in }} /></section>
    </div>
  );
}
