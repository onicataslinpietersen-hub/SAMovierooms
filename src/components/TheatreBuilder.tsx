"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useCart } from "@/store/cart";
import { zar } from "@/lib/money";
import { ProductArt } from "./ProductArt";

export type BuilderProduct = { slug: string; name: string; kind: string; categorySlug: string; fromCents: number; variantId: string; finishHex: string | null; inStock: boolean };

const ROOMS = [
  { id: "lounge", label: "Living room", hint: "Some ambient light, flexible seating" },
  { id: "cinema", label: "Dedicated cinema", hint: "Dark room, fixed seating" },
  { id: "outdoor", label: "Patio & garden", hint: "After sunset, portable setup" },
] as const;
const PICTURES = [
  { id: "projector", label: "Projector + screen", cats: ["native-4k-projectors", "4k-compatible-projectors", "smart-projectors"], extra: ["projector-screens"] },
  { id: "ust", label: "Laser TV (ultra-short-throw)", cats: ["laser-projectors"], extra: ["projector-screens"] },
  { id: "tv", label: "Television", cats: ["oled-televisions", "4k-smart-tvs", "large-screen-televisions"], extra: [] },
  { id: "portable", label: "Portable projector", cats: ["portable-projectors", "outdoor-projectors"], extra: ["tripods"] },
] as const;
const SOUNDS = [
  { id: "soundbar", label: "Soundbar", cats: ["soundbars"] },
  { id: "surround", label: "5.1 surround", cats: ["surround-sound-systems", "home-theatre-packages"] },
  { id: "builtin", label: "Built-in speakers", cats: [] as string[] },
] as const;

type Tier = "essential" | "signature";

export function TheatreBuilder({ products }: { products: BuilderProduct[] }) {
  const [room, setRoom] = useState<(typeof ROOMS)[number]["id"]>("lounge");
  const [picture, setPicture] = useState<(typeof PICTURES)[number]["id"]>("projector");
  const [sound, setSound] = useState<(typeof SOUNDS)[number]["id"]>("soundbar");
  const [glow, setGlow] = useState(true);
  const [tier, setTier] = useState<Tier>("essential");
  const add = useCart((s) => s.add);

  const picks = useMemo(() => {
    const pick = (cats: readonly string[]) => {
      const pool = products.filter((p) => cats.includes(p.categorySlug) && p.inStock).sort((a, b) => a.fromCents - b.fromCents);
      return pool.length ? (tier === "essential" ? pool[0] : pool[pool.length - 1]) : null;
    };
    const P = PICTURES.find((p) => p.id === picture)!, S = SOUNDS.find((s) => s.id === sound)!;
    const list = [pick(P.cats), ...P.extra.map((c) => pick([c])), S.cats.length ? pick(S.cats) : null, glow ? pick(["ambient-lighting"]) : null, picture !== "portable" ? pick(["hdmi-cables"]) : null];
    return list.filter((p): p is BuilderProduct => !!p).filter((p, i, a) => a.findIndex((x) => x.slug === p.slug) === i);
  }, [products, picture, sound, glow, tier]);
  const total = picks.reduce((s, p) => s + p.fromCents, 0);
  const outdoor = room === "outdoor";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
      {/* Interactive scene */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-void">
        <svg viewBox="0 0 800 560" className="block w-full" role="img" aria-label={`Preview: ${picture} with ${sound} in a ${room}`}>
          <defs>
            <linearGradient id="tb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1026" /><stop offset="1" stopColor="#2a1630" /></linearGradient>
            <linearGradient id="tb-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={room === "cinema" ? "#120d0a" : "#1f1712"} /><stop offset="1" stopColor="#0b0806" /></linearGradient>
            <linearGradient id="tb-film" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1436" /><stop offset=".5" stopColor="#c6532a" /><stop offset=".8" stopColor="#f5a83a" /><stop offset="1" stopColor="#3a1a08" /></linearGradient>
            <radialGradient id="tb-glow"><stop offset="0" stopColor="#f5a83a" stopOpacity=".55" /><stop offset="1" stopColor="#f5a83a" stopOpacity="0" /></radialGradient>
            <linearGradient id="tb-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffe6b8" stopOpacity=".35" /><stop offset="1" stopColor="#ffe6b8" stopOpacity=".03" /></linearGradient>
          </defs>
          <rect width="800" height="560" fill={outdoor ? "url(#tb-sky)" : "url(#tb-wall)"} />
          {outdoor ? (
            <g>
              {[[80, 60], [190, 110], [300, 40], [520, 80], [640, 44], [730, 120], [420, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" opacity=".8" />)}
              <path d="M0 330 q120 -70 240 -20 t260 -30 t300 20 V420 H0Z" fill="#0a0d14" />
              {[60, 150, 240, 330, 420, 510, 600, 690, 760].map((x, i) => <g key={x}><path d={`M${x - 45} 150 q45 26 90 0`} stroke="#3a2a1c" fill="none" /><circle cx={x} cy={163 + (i % 2) * 2} r="5" fill="#ffd08a" /><circle cx={x} cy="163" r="16" fill="url(#tb-glow)" /></g>)}
              <rect y="420" width="800" height="140" fill="#0c0f0b" />
            </g>
          ) : (
            <g>
              <path d="M0 420 H800 V560 H0Z" fill="#0d0907" />
              {room === "lounge" ? <g><rect x="620" y="150" width="120" height="180" fill="#1b2233" stroke="#2a1f16" strokeWidth="6" /><path d="M680 150v180M620 240h120" stroke="#2a1f16" strokeWidth="4" /></g> : null}
              {room === "cinema" ? [60, 120, 680, 740].map((x) => <rect key={x} x={x} y="80" width="34" height="320" rx="4" fill="#17100b" />) : null}
            </g>
          )}
          {/* bias light */}
          <AnimatePresence>{glow ? <motion.ellipse key="g" cx="400" cy="250" rx="330" ry="200" fill="url(#tb-glow)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} /> : null}</AnimatePresence>
          {/* picture */}
          <AnimatePresence mode="wait">
            <motion.g key={picture + room} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ transformOrigin: "400px 250px" }}>
              {picture === "tv" ? (
                <g><rect x="240" y="150" width="320" height="186" rx="6" fill="#050403" stroke="#3a2a1c" strokeWidth="3" /><rect x="247" y="157" width="306" height="172" fill="url(#tb-film)" /><circle cx="470" cy="230" r="18" fill="#fff3d0" /><rect x="340" y="336" width="120" height="8" fill="#1a130d" /></g>
              ) : picture === "portable" ? (
                <g><path d="M300 140 L290 400 M500 140 L510 400" stroke="#2a1f16" strokeWidth="5" /><rect x="285" y="132" width="230" height="140" fill="#e9e4da" /><rect x="285" y="132" width="230" height="140" fill="url(#tb-film)" opacity=".85" /><circle cx="450" cy="200" r="13" fill="#fff3d0" />
                  <path d="M400 452 L285 132 H515 Z" fill="url(#tb-beam)" /><rect x="380" y="448" width="40" height="46" rx="12" fill="#b45309" /><circle cx="400" cy="462" r="8" fill="#ffd89a" /></g>
              ) : (
                <g><rect x="170" y="110" width="460" height="262" fill="#050403" /><rect x="178" y="118" width="444" height="246" fill="url(#tb-film)" /><circle cx="500" cy="232" r="24" fill="#fff3d0" /><path d="M178 300 q110 -50 220 -14 t224 -22 v100 h-444z" fill="#1f0d09" opacity=".8" />
                  {picture === "ust" ? <g><path d="M400 404 L178 364 H622 Z" fill="url(#tb-beam)" /><rect x="320" y="400" width="160" height="26" rx="8" fill="#27272a" /><rect x="250" y="424" width="300" height="14" fill="#1a130d" /></g>
                    : <g><path d="M400 30 L178 118 H622 Z" fill="url(#tb-beam)" opacity=".7" /><rect x="372" y="14" width="56" height="24" rx="7" fill="#2a2420" /><circle cx="400" cy="34" r="6" fill="#ffd89a" /></g>}
                </g>
              )}
            </motion.g>
          </AnimatePresence>
          {/* sound */}
          <AnimatePresence mode="wait">
            <motion.g key={sound} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              {sound === "soundbar" ? <rect x="290" y="384" width="220" height="16" rx="8" fill="#27272a" stroke="#3a2a1c" /> : null}
              {sound === "surround" ? (
                <g fill="#17110c" stroke="#3a2a1c">
                  <rect x="112" y="200" width="36" height="190" rx="5" /><rect x="652" y="200" width="36" height="190" rx="5" /><rect x="350" y="384" width="100" height="20" rx="5" />
                  <rect x="40" y="440" width="44" height="90" rx="5" /><rect x="716" y="440" width="44" height="90" rx="5" /><rect x="560" y="360" width="56" height="56" rx="6" />
                  {[[130, 240], [130, 320], [670, 240], [670, 320], [588, 388]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="10" fill="#0a0806" />)}
                </g>
              ) : null}
            </motion.g>
          </AnimatePresence>
          {/* sofa */}
          <path d="M210 560 V500 q0 -34 34 -34 h312 q34 0 34 34 V560Z" fill="#070504" /><path d="M214 500 q0 -30 30 -30 h312 q30 0 30 30" stroke="#f5a83a" strokeOpacity={glow ? 0.7 : 0.25} strokeWidth="2" fill="none" />
        </svg>
        <div className="absolute left-4 top-4 flex gap-2"><span className="chip bg-black/50 backdrop-blur">{ROOMS.find((r) => r.id === room)!.label}</span></div>
      </div>

      {/* Controls + result */}
      <div>
        <Group label="1 · Your room">
          {ROOMS.map((r) => <Opt key={r.id} on={room === r.id} onClick={() => { setRoom(r.id); if (r.id === "outdoor") { setPicture("portable"); setSound("builtin"); } else if (picture === "portable") setPicture("projector"); }} title={r.label} hint={r.hint} />)}
        </Group>
        <Group label="2 · The picture">
          {PICTURES.map((p) => <Opt key={p.id} on={picture === p.id} onClick={() => setPicture(p.id)} title={p.label} />)}
        </Group>
        <Group label="3 · The sound">
          {SOUNDS.map((s) => <Opt key={s.id} on={sound === s.id} onClick={() => setSound(s.id)} title={s.label} />)}
        </Group>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button role="switch" aria-checked={glow} onClick={() => setGlow(!glow)} className="flex min-h-11 items-center gap-3 rounded-full border border-white/12 px-4 text-sm text-sand">
            <span className={`relative h-5 w-9 rounded-full transition-colors ${glow ? "bg-amber" : "bg-smoke"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-void transition-all ${glow ? "left-[18px]" : "left-0.5"}`} /></span>Ambient lighting
          </button>
          <div className="flex rounded-full border border-white/12 p-1" role="group" aria-label="Budget">
            {(["essential", "signature"] as Tier[]).map((t) => <button key={t} onClick={() => setTier(t)} aria-pressed={tier === t} className={`min-h-9 rounded-full px-4 text-xs font-semibold capitalize transition-colors ${tier === t ? "bg-amber text-void" : "text-sand"}`}>{t}</button>)}
          </div>
        </div>

        <div className="glass mt-7 rounded-2xl p-5">
          <p className="eyebrow">Your cinema</p>
          <ul className="mt-3 divide-y divide-white/[0.07]">
            {picks.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 py-2.5">
                <ProductArt kind={p.kind} finish={p.finishHex} className="h-10 w-14 shrink-0" />
                <Link href={`/p/${p.slug}`} className="min-w-0 flex-1 truncate text-sm hover:text-amber">{p.name}</Link>
                <span className="text-sm tabular-nums text-sand">{zar(p.fromCents)}</span>
              </li>
            ))}
            {!picks.length ? <li className="py-3 text-sm text-ash">No matching products are in stock right now.</li> : null}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div><p className="text-xs text-ash">Products total, excl. delivery</p><p className="text-2xl font-semibold tabular-nums">{zar(total)}</p></div>
            <button className="btn-primary" disabled={!picks.length} onClick={() => picks.forEach((p) => add(p.variantId, 1))}>Add all to cart</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset className="mt-5 first:mt-0"><legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-ash">{label}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>;
}
function Opt({ on, onClick, title, hint }: { on: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`min-h-11 rounded-2xl border px-4 py-2 text-left text-sm transition-all ${on ? "border-amber bg-amber/10 text-cream shadow-[0_0_30px_-12px_rgba(245,168,58,0.9)]" : "border-white/12 text-sand hover:border-white/30"}`}>
      <span className="font-medium">{title}</span>{hint ? <span className="block text-[11px] text-ash">{hint}</span> : null}
    </button>
  );
}
