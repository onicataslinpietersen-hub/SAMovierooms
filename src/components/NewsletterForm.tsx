"use client";
import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/public";

export function NewsletterForm({ compact }: { compact?: boolean }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok) return <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="w-full">
      <div className={`flex gap-2 ${compact ? "" : "flex-col sm:flex-row"}`}>
        <label className="sr-only" htmlFor={compact ? "nl-f" : "nl"}>Email address</label>
        <input id={compact ? "nl-f" : "nl"} name="email" type="email" required autoComplete="email" placeholder="you@example.co.za" className="field flex-1" />
        <button className={compact ? "btn-ghost shrink-0" : "btn-primary shrink-0"} disabled={pending}>{pending ? "Joining…" : "Subscribe"}</button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-dim">By subscribing you consent to receive marketing emails from SAMovierooms. Unsubscribe at any time. See our <a href="/privacy-policy" className="underline">privacy policy</a>.</p>
      {state && !state.ok ? <p className="mt-2 text-xs text-bad" role="alert">{state.message}</p> : null}
    </form>
  );
}
