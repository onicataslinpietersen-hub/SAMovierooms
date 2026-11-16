import Link from "next/link";
import { SceneFilm } from "@/components/CinemaScene";
import { Reveal } from "@/components/Reveal";
export const metadata = { title: "About SAMovierooms", description: "SAMovierooms is a South African home cinema store. Learn how we choose products, work with supplier partners and deliver to your door." };
export default function About() {
  const steps = [
    ["We choose", "We pick projectors, televisions and sound systems for how they perform in real rooms, and we list what they actually are — native resolution first."],
    ["You order", "You pay SAMovierooms securely in Rand and see delivery options, estimated dates and any import duties before you commit."],
    ["Our supplier ships", "The supplier partner that stocks your product packs it and ships it straight to your address. We do not hold inventory."],
    ["We stay with you", "Tracking updates come from us, and so does help with returns and warranty. One point of contact from order to movie night."],
  ];
  return (
    <>
      <section className="relative -mt-[68px] overflow-hidden pt-[68px]">
        <div className="absolute inset-0 opacity-50"><SceneFilm id="about" /></div>
        <div className="absolute inset-0 bg-gradient-to-b from-coal/70 via-coal/60 to-coal" />
        <div className="wrap relative py-24 sm:py-36">
          <p className="eyebrow">About SAMovierooms</p>
          <h1 className="display mt-5 max-w-4xl text-5xl sm:text-7xl">The feeling of the cinema, <span className="gold-text italic">in your own home.</span></h1>
          <p className="lede mt-6 max-w-2xl">The hush when the lights dim. A picture that fills the wall. Sound you feel in your chest. SAMovierooms exists to bring that into South African homes.</p>
        </div>
      </section>
      <section className="wrap py-16 sm:py-24">
        <Reveal><h2 className="display max-w-2xl text-4xl sm:text-5xl">How SAMovierooms works</h2><p className="lede mt-4 max-w-2xl">We are an online store with a simple model, and we would rather you understood it than discovered it.</p></Reveal>
        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => <Reveal key={t} delay={i * 0.08}><li className="glass h-full rounded-3xl p-7"><span className="display gold-text text-5xl">{i + 1}</span><h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-sand">{d}</p></li></Reveal>)}
        </ol>
      </section>
      <section className="wrap grid gap-10 border-t border-white/[0.07] py-16 sm:py-24 lg:grid-cols-2">
        <Reveal><h2 className="display text-4xl">What we promise</h2></Reveal>
        <Reveal delay={0.1}>
          <ul className="space-y-5 text-sand">
            <li><strong className="text-cream">Honest specifications.</strong> A projector that merely accepts a 4K signal is never described as 4K. Native resolution is on every display product page.</li>
            <li><strong className="text-cream">Transparent delivery.</strong> Delivery windows are estimates and are labelled as estimates. Import duties are disclosed before you pay.</li>
            <li><strong className="text-cream">Your rights, respected.</strong> A 7-day cooling-off period and a 6-month warranty of quality under South African law, handled by us.</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="btn-primary">Shop the collection</Link><Link href="/contact" className="btn-ghost">Talk to us</Link></div>
        </Reveal>
      </section>
    </>
  );
}
