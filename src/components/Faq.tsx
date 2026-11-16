import { FAQ } from "@/lib/faq";

export function FaqList({ items = FAQ }: { items?: typeof FAQ }) {
  return (
    <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex min-h-16 items-center justify-between gap-6 py-4 text-left text-base font-medium transition-colors hover:text-amber sm:text-lg">
            {f.q}
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-amber transition-transform duration-300 group-open:rotate-45">+</span>
          </summary>
          <p className="max-w-3xl pb-6 leading-relaxed text-sand">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
