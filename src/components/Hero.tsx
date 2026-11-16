"use client";
import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { SceneBeam, SceneRoom, SceneSeats } from "./CinemaScene";
import { ProductArt } from "./ProductArt";
import { IconArrow } from "./Icons";

/**
 * Full-screen hero: a layered private-cinema scene with pointer + scroll parallax.
 * Pure SVG/CSS (no WebGL, no image downloads) so it paints immediately on any device.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 18 }), sy = useSpring(my, { stiffness: 40, damping: 18 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const roomX = useTransform(sx, (v) => v * -14), roomY = useTransform(sy, (v) => v * -8);
  const seatX = useTransform(sx, (v) => v * 26), projX = useTransform(sx, (v) => v * 44), projY = useTransform(sy, (v) => v * 16);
  const roomScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.22]);
  const seatsY = useTransform(scrollYProgress, [0, 1], ["0%", "26%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <section ref={ref} className="relative -mt-[68px] h-[100svh] min-h-[640px] overflow-hidden bg-void"
      onPointerMove={(e) => { if (reduce || e.pointerType !== "mouse") return; const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}>
      <motion.div className="absolute inset-[-3%]" style={reduce ? undefined : { x: roomX, y: roomY, scale: roomScale }}>
        <SceneRoom />
        <div className="hidden md:block"><SceneBeam /></div>
      </motion.div>
      <motion.div className="absolute inset-x-[-4%] bottom-0 top-0" style={reduce ? undefined : { x: seatX, y: seatsY }}><SceneSeats /></motion.div>

      {/* the projector in the foreground */}
      <motion.div className="pointer-events-none absolute bottom-[4%] right-[-4%] hidden w-[36vw] max-w-[620px] md:block" style={reduce ? undefined : { x: projX, y: projY }}>
        <div className="absolute inset-x-[10%] bottom-[8%] h-1/3 rounded-full bg-amber/30 blur-3xl" />
        <ProductArt kind="projector" finish="#2a2420" className="relative w-full drop-shadow-[0_40px_60px_rgba(0,0,0,0.85)]" label="Premium home cinema projector" />
      </motion.div>

      {/* legibility gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_30%_55%,rgba(7,6,5,0.78),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-coal to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />

      <motion.div className="wrap relative flex h-full flex-col justify-center pt-16" style={reduce ? undefined : { y: copyY, opacity: fade }}>
        <p className="eyebrow animate-rise" style={{ animationDelay: "0.1s" }}>Premium home cinema · South Africa</p>
        <h1 className="display text-glow mt-6 max-w-[13ch] text-[clamp(3rem,9.2vw,8.2rem)] uppercase animate-rise" style={{ animationDelay: "0.2s" }}>
          Bring the <span className="gold-text italic">cinema</span> home.
        </h1>
        <p className="lede mt-7 max-w-xl animate-rise" style={{ animationDelay: "0.38s" }}>
          Discover a better way to experience entertainment. From crystal-clear visuals to immersive home theatre experiences, transform any room into your personal cinema.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row animate-rise" style={{ animationDelay: "0.5s" }}>
          <Link href="/c/projectors" className="btn-primary">Explore Projectors <IconArrow className="h-4 w-4" /></Link>
          <Link href="/c/home-theatre" className="btn-ghost">Discover Home Cinema</Link>
        </div>
      </motion.div>

      <a href="#featured" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ash transition-colors hover:text-amber sm:flex">
        Scroll
        <span className="h-10 w-px overflow-hidden bg-white/15"><span className="block h-4 w-px animate-[rise_1.8s_ease-in-out_infinite] bg-amber" /></span>
      </a>
    </section>
  );
}
