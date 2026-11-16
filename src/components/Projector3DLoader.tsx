"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Hotspot } from "./Projector3D";
import { ProductArt } from "./ProductArt";

const Projector3D = dynamic(() => import("./Projector3D"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-xs uppercase tracking-[0.2em] text-dim">Loading 3D view…</div> });

/**
 * Loads the WebGL viewer only when it scrolls into view on a capable, fine-pointer device.
 * Phones and reduced-motion/data-saver users get the lightweight illustration with an opt-in button.
 */
export function Projector3DLoader({ finish, shape, hotspots, kind, className = "" }: { finish?: string; shape?: "standard" | "ust" | "portable"; hotspots?: Hotspot[]; kind: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"art" | "3d">("art");
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    const light = window.matchMedia("(max-width: 900px), (pointer: coarse), (prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    let webgl = false;
    try { webgl = !!document.createElement("canvas").getContext("webgl2"); } catch { /* no webgl */ }
    if (light || !webgl) return;
    setAuto(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setMode("3d"); io.disconnect(); } }, { rootMargin: "200px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`relative ${className}`}>
      {mode === "3d" ? <Projector3D finish={finish} shape={shape} hotspots={hotspots} className="h-full w-full" /> : (
        <div className="grid h-full place-items-center">
          <ProductArt kind={kind} finish={finish} className="h-[80%] w-[86%]" />
          {!auto ? <button onClick={() => setMode("3d")} className="btn-ghost btn-sm absolute bottom-4 left-1/2 -translate-x-1/2">View in 3D</button> : null}
        </div>
      )}
    </div>
  );
}
