"use client";
import { useActionState, useState } from "react";
import { submitReview } from "@/app/actions/account";
import { IconStar } from "./Icons";

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(submitReview, null);
  const [rating, setRating] = useState(5);
  if (state?.ok) return <p className="rounded-xl border border-ok/30 bg-ok/10 p-4 text-sm text-ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} /><input type="hidden" name="rating" value={rating} />
      <div role="radiogroup" aria-label="Rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="grid h-11 w-9 place-items-center text-amber"><IconStar filled={n <= rating} className="h-6 w-6" /></button>)}
      </div>
      <div><label className="label" htmlFor="rv-t">Headline</label><input id="rv-t" name="title" className="field" maxLength={120} /></div>
      <div><label className="label" htmlFor="rv-b">Your review</label><textarea id="rv-b" name="body" rows={4} required className="field" /></div>
      {state && !state.ok ? <p className="text-sm text-bad" role="alert">{state.message}</p> : null}
      <button className="btn-ghost" disabled={pending}>{pending ? "Sending…" : "Submit review"}</button>
    </form>
  );
}
