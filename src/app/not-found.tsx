import Link from "next/link";
export default function NotFound() {
  return <section className="wrap grid min-h-[70vh] place-items-center py-20 text-center"><div><p className="display gold-text text-8xl">404</p><h1 className="display mt-4 text-4xl">This screening isn&rsquo;t showing.</h1><p className="mt-3 text-ash">The page you are looking for has moved or never existed.</p><div className="mt-8 flex justify-center gap-3"><Link href="/" className="btn-primary">Back to home</Link><Link href="/shop" className="btn-ghost">Browse products</Link></div></div></section>;
}
