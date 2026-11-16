import Link from "next/link";
import { FaqList } from "@/components/Faq";
import { FAQ } from "@/lib/faq";
export const metadata = { title: "Frequently Asked Questions", description: "Answers about ordering, delivery to South Africa, import duties, returns, warranties and payments at SAMovierooms." };
export default function FaqPage() {
  const groups = [...new Set(FAQ.map((f) => f.group))];
  return (
    <section className="wrap max-w-4xl py-12 sm:py-16">
      <p className="eyebrow">Help centre</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">Frequently asked questions</h1>
      {groups.map((g) => <div key={g} className="mt-12"><h2 className="display mb-4 text-2xl text-amber">{g}</h2><FaqList items={FAQ.filter((f) => f.group === g)} /></div>)}
      <div className="glass mt-14 rounded-3xl p-8 text-center"><p className="display text-2xl">Still have a question?</p><Link href="/contact" className="btn-primary mt-5">Contact us</Link></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }).replace(/</g, "\\u003c") }} />
    </section>
  );
}
