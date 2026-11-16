import { Card, PageHead, dt } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata = { title: "Email outbox" };

export default async function Outbox() {
  await requireStaff(["admin", "support"]);
  const rows = await q<{ id: string; to_email: string; subject: string; body: string; status: string; error: string | null; created_at: Date }>("SELECT * FROM email_outbox ORDER BY id DESC LIMIT 100");
  return (
    <>
      <PageHead title="Email outbox" sub={env.smtpUrl ? "Every email sent to customers, most recent first." : "No SMTP server is configured (SMTP_URL), so emails are recorded here but NOT delivered. Configure SMTP before launch."} />
      <Card>
        {rows.length ? <ul className="divide-y divide-white/[0.07]">{rows.map((m) => (
          <li key={m.id} className="py-3"><details><summary className="flex flex-wrap items-center justify-between gap-3 text-sm"><span><span className="font-medium">{m.subject}</span><span className="block text-xs text-ash">to {m.to_email} · {dt(m.created_at)}</span></span><span className={`chip ${m.status === "sent" ? "text-ok" : m.status === "failed" ? "text-bad" : "text-amber"}`}>{m.status === "logged" ? "recorded, not sent" : m.status}</span></summary><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-void p-4 font-sans text-xs leading-relaxed text-sand">{m.body}</pre>{m.error ? <p className="mt-2 text-xs text-bad">{m.error}</p> : null}</details></li>))}</ul>
          : <p className="text-sm text-ash">No emails yet.</p>}
      </Card>
    </>
  );
}
