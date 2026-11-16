import { AddressForm } from "@/components/SimpleForms";
import { deleteAddress } from "@/app/actions/account";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
export default async function Addresses() {
  const u = await requireUser("/account/addresses");
  const rows = await q<{ id: string; label: string; recipient: string; line1: string; line2: string | null; suburb: string | null; city: string; province: string; postal_code: string; phone: string; is_default: boolean }>("SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC", [u.id]);
  return (
    <div className="space-y-8">
      <section><h2 className="display mb-4 text-2xl">Saved addresses</h2>
        {rows.length ? <ul className="grid gap-4 sm:grid-cols-2">{rows.map((a) => (
          <li key={a.id} className="panel p-5 text-sm"><p className="flex items-center gap-2 font-semibold">{a.label}{a.is_default ? <span className="chip-amber">Default</span> : null}</p>
            <address className="mt-2 not-italic leading-relaxed text-sand">{a.recipient}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.suburb ? `${a.suburb}, ` : ""}{a.city}, {a.province} {a.postal_code}<br />{a.phone}</address>
            <form action={deleteAddress} className="mt-3"><input type="hidden" name="id" value={a.id} /><button className="text-xs text-ash underline-offset-4 hover:text-bad hover:underline">Remove</button></form></li>))}</ul>
          : <p className="text-sm text-ash">No saved addresses yet. Add one below for faster checkout.</p>}
      </section>
      <section className="panel p-6"><h2 className="display mb-5 text-2xl">Add an address</h2><AddressForm /></section>
    </div>
  );
}
