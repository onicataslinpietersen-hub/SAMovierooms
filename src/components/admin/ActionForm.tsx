"use client";
import { useActionState } from "react";
type R = { ok: boolean; message: string } | null;
/** Wraps a server action: pending state, success/error message, optional confirmation prompt. */
export function ActionForm({ action, children, className, confirm, inline }: { action: (s: R, fd: FormData) => Promise<R>; children: React.ReactNode; className?: string; confirm?: string; inline?: boolean }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={className} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} aria-busy={pending}>
      <fieldset disabled={pending} className={inline ? "contents" : "min-w-0 disabled:opacity-60"}>{children}</fieldset>
      {state ? <p role={state.ok ? "status" : "alert"} className={`mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${state.ok ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>{state.message}</p> : null}
    </form>
  );
}
