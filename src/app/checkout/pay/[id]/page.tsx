import { notFound, redirect } from "next/navigation";
import { AutoForm } from "@/components/AutoForm";
import { q1 } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { startPayment } from "@/lib/payments";

export const metadata = { title: "Payment", robots: { index: false } };

export default async function Pay({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = await q1<{ access_token: string; status: string }>("SELECT o.access_token, p.status FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1", [id]);
  if (!row || !t || !safeEqual(row.access_token, t) || row.status !== "initiated") notFound();
  const start = await startPayment(id);
  if (start.kind === "redirect") redirect(start.url);
  return <section className="wrap py-24"><AutoForm action={start.action} fields={start.fields} /></section>;
}
