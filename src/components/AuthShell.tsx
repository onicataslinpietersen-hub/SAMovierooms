import { SceneFilm } from "./CinemaScene";
export function AuthShell({ eyebrow, title, children, footer }: { eyebrow: string; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="wrap grid min-h-[78vh] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="relative hidden aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/[0.08] lg:block">
        <SceneFilm id="auth" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <p className="display absolute inset-x-8 bottom-8 text-4xl">Your seat is<br />waiting.</p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-4 text-4xl sm:text-5xl">{title}</h1>
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-6 text-sm text-ash">{footer}</div> : null}
      </div>
    </section>
  );
}
