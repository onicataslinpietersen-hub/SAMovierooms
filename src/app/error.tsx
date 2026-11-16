"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <section className="wrap grid min-h-[70vh] place-items-center py-20 text-center"><div><h1 className="display text-4xl">The projector flickered.</h1><p className="mt-3 text-ash">Something went wrong on our side. Your cart is safe.</p><button onClick={reset} className="btn-primary mt-8">Try again</button></div></section>;
}
