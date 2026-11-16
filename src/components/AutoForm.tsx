"use client";
import { useEffect, useRef } from "react";

/** Posts the signed field set to the payment gateway's hosted page. */
export function AutoForm({ action, fields }: { action: string; fields: [string, string][] }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.submit(); }, []);
  return (
    <form ref={ref} action={action} method="post" className="panel mx-auto max-w-md p-8 text-center">
      {fields.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <p className="display text-2xl">Redirecting to secure payment…</p>
      <p className="mt-2 text-sm text-ash">If nothing happens, use the button below.</p>
      <button className="btn-primary mt-6">Continue to payment</button>
    </form>
  );
}
