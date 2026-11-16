import { TicketForm } from "@/components/SimpleForms";
import { StatusChip } from "@/components/OrderList";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
export default async function Support() {
  const u = await requireUser("/account/support");
  const tickets = await q<{ id: string; subject: string; message: string; status: string; admin_reply: string | null; order_number: string | null; created_at: Date }>("SELECT * FROM support_tickets WHERE user_id=$1 OR lower(email)=$2 ORDER BY created_at DESC", [u.id, u.email]);
  return (
    <div className="space-y-8">
      <section><h2 className="display mb-4 text-2xl">Your support requests</h2>
        {tickets.length ? <ul className="space-y-3">{tickets.map((t) => (
          <li key={t.id} className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{t.subject}</p><StatusChip status={t.status} /></div>
            <p className="mt-1 text-xs text-dim">{t.created_at.toLocaleDateString("en-ZA")}{t.order_number ? ` · ${t.order_number}` : ""}</p><p className="mt-3 whitespace-pre-line text-sm text-sand">{t.message}</p>
            {t.admin_reply ? <div className="mt-4 rounded-xl border border-amber/30 bg-amber/[0.06] p-4"><p className="text-xs font-semibold text-amber">SAMovierooms replied</p><p className="mt-1 whitespace-pre-line text-sm text-sand">{t.admin_reply}</p></div> : null}</li>))}</ul>
          : <p className="text-sm text-ash">You have no support requests.</p>}
      </section>
      <section className="panel p-6"><h2 className="display mb-5 text-2xl">New request</h2><TicketForm name={`${u.first_name} ${u.last_name}`.trim()} email={u.email} order="" /></section>
    </div>
  );
}
