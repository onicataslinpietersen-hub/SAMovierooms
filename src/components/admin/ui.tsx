import Link from "next/link";
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="display text-3xl sm:text-4xl">{title}</h1>{sub ? <p className="mt-1 max-w-3xl text-sm text-ash">{sub}</p> : null}</div><div className="flex flex-wrap gap-2">{children}</div></div>;
}
export function Stat({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn"; href?: string }) {
  const body = (<><p className="text-[11px] font-semibold uppercase tracking-wider text-ash">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "good" ? "text-ok" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-amber" : ""}`}>{value}</p>{sub ? <p className="mt-1 text-xs text-dim">{sub}</p> : null}</>);
  return href ? <Link href={href} className="panel block p-5 transition-colors hover:border-amber/40">{body}</Link> : <div className="panel p-5">{body}</div>;
}
export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel p-5 sm:p-6 ${className}`}>{title ? <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sand">{title}</h2> : null}{children}</section>;
}
export function Scroll({ children }: { children: React.ReactNode }) { return <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">{children}</div>; }
export function Field({ label, name, defaultValue, type = "text", hint, ...rest }: { label: string; name: string; defaultValue?: string | number | null; type?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div><label className="label" htmlFor={`f-${name}`}>{label}</label><input id={`f-${name}`} name={name} type={type} defaultValue={defaultValue ?? ""} className="field" {...rest} />{hint ? <p className="mt-1 text-[11px] text-dim">{hint}</p> : null}</div>;
}
export function Area({ label, name, defaultValue, rows = 3, hint, mono }: { label: string; name: string; defaultValue?: string | null; rows?: number; hint?: string; mono?: boolean }) {
  return <div><label className="label" htmlFor={`f-${name}`}>{label}</label><textarea id={`f-${name}`} name={name} rows={rows} defaultValue={defaultValue ?? ""} className={`field ${mono ? "font-mono text-xs" : ""}`} />{hint ? <p className="mt-1 text-[11px] text-dim">{hint}</p> : null}</div>;
}
export const dt = (d: Date | null) => (d ? d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
