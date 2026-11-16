import Link from "next/link";
import { TicketForm } from "@/components/SimpleForms";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
export const metadata = { title: "Contact us", description: "Get in touch with SAMovierooms about an order, a product, a return or a warranty claim." };
export default async function Contact({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [u, s, sp] = await Promise.all([getUser(), getSettings(), searchParams]);
  return (
    <section className="wrap grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="display mt-4 text-5xl sm:text-6xl">We&rsquo;re here to help.</h1>
        <p className="lede mt-5">Order questions, product advice, returns and warranty claims all come to us — you never need to chase a supplier.</p>
        <dl className="mt-8 space-y-4 text-sm">
          {s.support_email ? <div><dt className="text-ash">Email</dt><dd><a className="link" href={`mailto:${s.support_email}`}>{s.support_email}</a></dd></div> : null}
          {s.support_phone ? <div><dt className="text-ash">Phone</dt><dd>{s.support_phone}</dd></div> : null}
          {s.physical_address ? <div><dt className="text-ash">Address</dt><dd className="whitespace-pre-line">{s.physical_address}</dd></div> : null}
        </dl>
        <p className="mt-8 text-sm text-ash">Looking for a delivery update? <Link href="/track" className="link">Track your order</Link>. Quick answers are in the <Link href="/faq" className="link">FAQ</Link>.</p>
      </div>
      <div className="panel p-6 sm:p-8"><TicketForm name={u ? `${u.first_name} ${u.last_name}`.trim() : ""} email={u?.email ?? ""} order={sp.order ?? ""} /></div>
    </section>
  );
}
