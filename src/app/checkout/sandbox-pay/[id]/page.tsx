import { notFound } from "next/navigation";
import { sandboxPay } from "@/app/actions/checkout";
import { q1 } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { sandboxPayToken } from "@/lib/payments";
import { zar } from "@/lib/money";

export const metadata = { title: "Sandbox payment", robots: { index: false } };

export default async function SandboxPay({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  if (!env.demoMode || !k || !/^[0-9a-f-]{36}$/.test(id) || !safeEqual(sandboxPayToken(id), k)) notFound();
  const p = await q1<{ amount_cents: number; status: string; number: string }>("SELECT p.amount_cents, p.status, o.number FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1", [id]);
  if (!p) notFound();
  return (
    <section className="wrap grid min-h-[70vh] place-items-center py-16">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <span className="chip-amber">Sandbox payment gateway</span>
        <h1 className="display mt-5 text-3xl">Simulated payment</h1>
        <p className="mt-2 text-sm text-ash">This stands in for the real gateway while the store is in demo mode. No money moves.</p>
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-ash">Order {p.number}</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{zar(p.amount_cents, { decimals: true })}</p>
        {p.status === "initiated" ? (
          <form action={sandboxPay} className="mt-8 grid gap-3">
            <input type="hidden" name="id" value={id} /><input type="hidden" name="k" value={k} />
            <button name="outcome" value="succeeded" className="btn-primary">Approve payment</button>
            <button name="outcome" value="failed" className="btn-ghost">Simulate declined card</button>
            <button name="outcome" value="cancelled" className="text-sm text-ash underline-offset-4 hover:underline">Cancel and return</button>
          </form>
        ) : <p className="mt-8 text-sm text-sand">This payment has already been completed ({p.status}).</p>}
      </div>
    </section>
  );
}
