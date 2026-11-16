"use client";
import Link from "next/link";
import { useActionState } from "react";
import { trackOrder } from "@/app/actions/checkout";
import { forgotPassword, login, register, resetPassword, saveAddress, updateProfile } from "@/app/actions/account";
import { createTicket } from "@/app/actions/public";
import { PROVINCES } from "@/lib/shipping";

const Err = ({ s }: { s: { ok?: boolean; message: string } | null }) => (s && !s.ok ? <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad" role="alert">{s.message}</p> : null);
const Ok = ({ s }: { s: { ok?: boolean; message: string } | null }) => (s?.ok ? <p className="rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok" role="status">{s.message}</p> : null);

export function TrackForm() {
  const [s, action, pending] = useActionState(trackOrder, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="t-n">Order number</label><input id="t-n" name="number" required placeholder="SAM-10001" className="field" /></div>
      <div><label className="label" htmlFor="t-e">Email used for the order</label><input id="t-e" name="email" type="email" required autoComplete="email" className="field" /></div>
      {s ? <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad" role="alert">{s.message}</p> : null}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Finding your order…" : "Track order"}</button>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div><label className="label" htmlFor="l-e">Email</label><input id="l-e" name="email" type="email" required autoComplete="email" className="field" /></div>
      <div><div className="flex justify-between"><label className="label" htmlFor="l-p">Password</label><Link href="/forgot-password" className="text-xs text-amber hover:underline">Forgot password?</Link></div><input id="l-p" name="password" type="password" required autoComplete="current-password" className="field" /></div>
      <Err s={s} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState(register, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label" htmlFor="r-f">First name</label><input id="r-f" name="firstName" required autoComplete="given-name" className="field" /></div>
        <div><label className="label" htmlFor="r-l">Last name</label><input id="r-l" name="lastName" required autoComplete="family-name" className="field" /></div>
      </div>
      <div><label className="label" htmlFor="r-e">Email</label><input id="r-e" name="email" type="email" required autoComplete="email" className="field" /></div>
      <div><label className="label" htmlFor="r-p">Password</label><input id="r-p" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" /><p className="mt-1 text-xs text-dim">At least 10 characters, with a letter and a number.</p></div>
      <label className="flex items-start gap-3 text-sm text-sand"><input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 accent-[#f5a83a]" /><span>I agree to the <Link href="/terms" className="link">Terms</Link> and <Link href="/privacy-policy" className="link">Privacy Policy</Link>.</span></label>
      <label className="flex items-start gap-3 text-sm text-sand"><input type="checkbox" name="marketing" className="mt-0.5 h-5 w-5 accent-[#f5a83a]" /><span>Email me offers and new arrivals (optional).</span></label>
      <Err s={s} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function ForgotForm() {
  const [s, action, pending] = useActionState(forgotPassword, null);
  if (s?.ok) return <Ok s={s} />;
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="f-e">Email</label><input id="f-e" name="email" type="email" required autoComplete="email" className="field" /></div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Email me a reset link"}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="rp">New password</label><input id="rp" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
      <Err s={s} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Set new password"}</button>
    </form>
  );
}

export function ProfileForm({ u }: { u: { firstName: string; lastName: string; phone: string; marketing: boolean } }) {
  const [s, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="p-f">First name</label><input id="p-f" name="firstName" defaultValue={u.firstName} required className="field" /></div>
        <div><label className="label" htmlFor="p-l">Last name</label><input id="p-l" name="lastName" defaultValue={u.lastName} required className="field" /></div>
      </div>
      <div><label className="label" htmlFor="p-p">Phone</label><input id="p-p" name="phone" type="tel" defaultValue={u.phone} className="field" /></div>
      <label className="flex items-center gap-3 text-sm text-sand"><input type="checkbox" name="marketing" defaultChecked={u.marketing} className="h-5 w-5 accent-[#f5a83a]" />Email me offers and new arrivals</label>
      <Err s={s} /><Ok s={s} />
      <button className="btn-ghost" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

export function AddressForm() {
  const [s, action, pending] = useActionState(saveAddress, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={s?.ok ? "saved" : "f"}>
      <div><label className="label" htmlFor="a-lb">Label</label><input id="a-lb" name="label" defaultValue="Home" className="field" /></div>
      <div><label className="label" htmlFor="a-r">Recipient name</label><input id="a-r" name="recipient" required className="field" /></div>
      <div><label className="label" htmlFor="a-p">Mobile number</label><input id="a-p" name="phone" type="tel" required placeholder="082 123 4567" className="field" /></div>
      <div><label className="label" htmlFor="a-1">Street address</label><input id="a-1" name="line1" required className="field" /></div>
      <div><label className="label" htmlFor="a-2">Complex / building</label><input id="a-2" name="line2" className="field" /></div>
      <div><label className="label" htmlFor="a-s">Suburb</label><input id="a-s" name="suburb" className="field" /></div>
      <div><label className="label" htmlFor="a-c">City / town</label><input id="a-c" name="city" required className="field" /></div>
      <div className="grid grid-cols-[1fr_110px] gap-4">
        <div><label className="label" htmlFor="a-pr">Province</label><select id="a-pr" name="province" required className="field" defaultValue=""><option value="" disabled>Select…</option>{PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></div>
        <div><label className="label" htmlFor="a-pc">Postal code</label><input id="a-pc" name="postalCode" required pattern="\d{4}" maxLength={4} inputMode="numeric" className="field" /></div>
      </div>
      <label className="flex items-center gap-3 text-sm text-sand sm:col-span-2"><input type="checkbox" name="isDefault" className="h-5 w-5 accent-[#f5a83a]" />Make this my default address</label>
      <div className="sm:col-span-2"><Err s={s} /><Ok s={s} /></div>
      <div><button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save address"}</button></div>
    </form>
  );
}

export function TicketForm({ name, email, order }: { name: string; email: string; order: string }) {
  const [s, action, pending] = useActionState(createTicket, null);
  if (s?.ok) return <Ok s={s} />;
  return (
    <form action={action} className="space-y-4">
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-n">Your name</label><input id="c-n" name="name" defaultValue={name} required className="field" /></div>
        <div><label className="label" htmlFor="c-e">Email</label><input id="c-e" name="email" type="email" defaultValue={email} required className="field" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-s">Subject</label><input id="c-s" name="subject" required className="field" /></div>
        <div><label className="label" htmlFor="c-o">Order number <span className="text-dim">(optional)</span></label><input id="c-o" name="orderNumber" defaultValue={order} placeholder="SAM-10001" className="field" /></div>
      </div>
      <div><label className="label" htmlFor="c-m">How can we help?</label><textarea id="c-m" name="message" rows={6} required className="field" /></div>
      <Err s={s} />
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
    </form>
  );
}
