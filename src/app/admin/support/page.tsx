import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, PageHead, dt } from "@/components/admin/ui";
import { StatusChip } from "@/components/OrderList";
import { moderateReview, replyTicket } from "@/app/actions/admin";
import { requireStaff } from "@/lib/auth";
import { q } from "@/lib/db";

export const metadata = { title: "Support & reviews" };

export default async function Support() {
  await requireStaff(["admin", "support"]);
  const [tickets, reviews, subs] = await Promise.all([
    q<{ id: string; email: string; name: string; order_number: string | null; subject: string; message: string; status: string; admin_reply: string | null; created_at: Date }>("SELECT * FROM support_tickets ORDER BY (status='open') DESC, created_at DESC LIMIT 60"),
    q<{ id: string; rating: number; title: string; body: string; status: string; verified_purchase: boolean; product: string; email: string; created_at: Date }>("SELECT r.id, r.rating, r.title, r.body, r.status, r.verified_purchase, p.name AS product, u.email, r.created_at FROM reviews r JOIN products p ON p.id=r.product_id JOIN users u ON u.id=r.user_id ORDER BY (r.status='pending') DESC, r.created_at DESC LIMIT 60"),
    q<{ n: number }>("SELECT count(*)::int AS n FROM newsletter_subscribers WHERE unsubscribed_at IS NULL"),
  ]);
  return (
    <>
      <PageHead title="Support & reviews" sub={`${tickets.filter((t) => t.status === "open").length} open requests · ${reviews.filter((r) => r.status === "pending").length} reviews awaiting moderation · ${subs[0].n} newsletter subscribers`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Customer support requests">
          {tickets.length ? <ul className="space-y-4">{tickets.map((t) => (
            <li key={t.id} className="rounded-xl border border-white/[0.07] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{t.subject}</p><StatusChip status={t.status === "open" ? "pending_payment" : "delivered"} /></div>
              <p className="text-xs text-ash">{t.name} · <a href={`mailto:${t.email}`} className="link">{t.email}</a> · {dt(t.created_at)}{t.order_number ? <> · <Link className="link" href={`/admin/orders?q=${t.order_number}`}>{t.order_number}</Link></> : null}</p>
              <p className="mt-3 whitespace-pre-line text-sm text-sand">{t.message}</p>
              {t.admin_reply ? <p className="mt-3 whitespace-pre-line rounded-lg bg-amber/[0.06] p-3 text-sm text-sand"><span className="text-xs font-semibold text-amber">Reply sent</span><br />{t.admin_reply}</p> : (
                <ActionForm action={replyTicket} className="mt-3"><input type="hidden" name="id" value={t.id} /><label className="sr-only" htmlFor={`r-${t.id}`}>Reply</label><textarea id={`r-${t.id}`} name="reply" rows={3} className="field" placeholder="Write a reply — it is emailed to the customer" required /><button className="btn-primary btn-sm mt-2">Send reply</button></ActionForm>
              )}
            </li>))}</ul> : <p className="text-sm text-ash">No support requests yet.</p>}
        </Card>
        <Card title="Review moderation">
          {reviews.length ? <ul className="space-y-4">{reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-white/[0.07] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} · {r.product}</p><span className={`chip ${r.status === "approved" ? "text-ok" : r.status === "rejected" ? "text-bad" : "text-amber"}`}>{r.status}</span></div>
              <p className="text-xs text-ash">{r.email} · {dt(r.created_at)} · {r.verified_purchase ? "verified purchase" : "no matching order"}</p>
              {r.title ? <p className="mt-2 text-sm font-medium">{r.title}</p> : null}<p className="mt-1 text-sm text-sand">{r.body}</p>
              <div className="mt-3 flex gap-2">{(["approved", "rejected"] as const).filter((s) => s !== r.status).map((s) => <form key={s} action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={s} /><button className="btn-ghost btn-sm">{s === "approved" ? "Approve & publish" : "Reject"}</button></form>)}</div>
            </li>))}</ul> : <p className="text-sm text-ash">No reviews submitted yet.</p>}
        </Card>
      </div>
    </>
  );
}
