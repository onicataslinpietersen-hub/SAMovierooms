"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type Hotspot = { id: string; label: string; body: string; position: [number, number, number] };
type Shape = "standard" | "ust" | "portable";

function Lens({ position, rotation, r = 0.42 }: { position: [number, number, number]; rotation?: [number, number, number]; r?: number }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r * 1.18, r * 1.18, 0.22, 48]} /><meshStandardMaterial color="#0b0a09" metalness={0.9} roughness={0.25} /></mesh>
      <mesh position={[0, 0, 0.115]}><torusGeometry args={[r * 1.02, 0.018, 16, 64]} /><meshStandardMaterial color="#f5a83a" emissive="#f5a83a" emissiveIntensity={0.7} /></mesh>
      <mesh position={[0, 0, 0.06]} scale={[1, 1, 0.45]}><sphereGeometry args={[r, 48, 32]} /><meshPhysicalMaterial color="#1a0f08" metalness={0.1} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} emissive="#f5a83a" emissiveIntensity={0.06} /></mesh>
    </group>
  );
}

function Beam({ on, position, rotation }: { on: boolean; position: [number, number, number]; rotation: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = on ? 0.11 + Math.sin(clock.elapsedTime * 7) * 0.012 : 0; });
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <coneGeometry args={[1.5, 4.2, 4, 1, true]} />
      <meshBasicMaterial color="#ffd89a" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Model({ finish, shape, power }: { finish: string; shape: Shape; power: boolean }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: finish, metalness: 0.55, roughness: 0.38 }), [finish]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0c0a09", metalness: 0.7, roughness: 0.5 }), []);
  if (shape === "portable") {
    return (
      <group>
        <mesh material={body}><cylinderGeometry args={[0.72, 0.78, 1.7, 64]} /></mesh>
        <mesh position={[0, -0.5, 0]} material={dark}><cylinderGeometry args={[0.79, 0.79, 0.62, 64, 1, true]} /></mesh>
        <mesh position={[0, 0.98, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.5, 0.045, 16, 48, Math.PI]} /><meshStandardMaterial color="#c9a26a" metalness={0.9} roughness={0.25} /></mesh>
        <Lens position={[0, 0.32, 0.66]} r={0.3} />
        <Beam on={power} position={[0, 0.32, 2.85]} rotation={[-Math.PI / 2, Math.PI / 4, 0]} />
      </group>
    );
  }
  if (shape === "ust") {
    return (
      <group>
        <RoundedBox args={[3.1, 0.62, 1.7]} radius={0.14} smoothness={6} material={body} />
        <mesh position={[0, 0.32, 0.2]} material={dark}><boxGeometry args={[1.3, 0.04, 0.6]} /></mesh>
        <Lens position={[0, 0.3, 0.2]} rotation={[-Math.PI / 2.6, 0, 0]} r={0.26} />
        <mesh position={[0, 0, 0.86]} material={dark}><boxGeometry args={[2.8, 0.36, 0.02]} /></mesh>
        <Beam on={power} position={[0, 2.1, -0.75]} rotation={[Math.PI + 0.42, Math.PI / 4, 0]} />
      </group>
    );
  }
  return (
    <group>
      <RoundedBox args={[2.6, 0.92, 1.9]} radius={0.2} smoothness={6} material={body} />
      <Lens position={[-0.62, 0.02, 0.95]} />
      {Array.from({ length: 7 }).map((_, i) => <mesh key={i} position={[0.35 + i * 0.13, 0, 0.955]} material={dark}><boxGeometry args={[0.055, 0.42, 0.02]} /></mesh>)}
      {Array.from({ length: 9 }).map((_, i) => <mesh key={i} position={[1.305, 0, -0.6 + i * 0.15]} material={dark}><boxGeometry args={[0.02, 0.5, 0.07]} /></mesh>)}
      <mesh position={[0.75, 0.47, -0.3]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.05, 40]} /><meshStandardMaterial color="#c9a26a" metalness={0.95} roughness={0.2} /></mesh>
      <mesh position={[1.0, 0.2, 0.955]}><sphereGeometry args={[0.03, 16, 16]} /><meshStandardMaterial color="#f5a83a" emissive="#f5a83a" emissiveIntensity={power ? 3 : 0.4} /></mesh>
      {[[-1, -0.5, 0.7], [1, -0.5, 0.7], [0, -0.5, -0.7]].map((p, i) => <mesh key={i} position={p as [number, number, number]} material={dark}><cylinderGeometry args={[0.12, 0.14, 0.1, 24]} /></mesh>)}
      {/* rear I/O */}
      <mesh position={[0, -0.05, -0.955]} material={dark}><boxGeometry args={[1.5, 0.4, 0.02]} /></mesh>
      <Beam on={power} position={[-0.62, 0.02, 3.2]} rotation={[-Math.PI / 2, Math.PI / 4, 0]} />
    </group>
  );
}

function Spot({ h, active, onSelect }: { h: Hotspot; active: boolean; onSelect: (id: string | null) => void }) {
  return (
    <Html position={h.position} center zIndexRange={[20, 0]}>
      <div className="relative">
        <button onClick={() => onSelect(active ? null : h.id)} aria-label={h.label} aria-expanded={active}
          className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-bold transition-all ${active ? "scale-110 border-amber bg-amber text-black" : "border-amber/70 bg-black/60 text-amber hover:bg-amber hover:text-black"}`}>
          <span className="absolute inset-0 animate-ping rounded-full border border-amber/50" style={{ animationDuration: "2.4s" }} />+
        </button>
        {active ? (
          <div className="glass absolute left-9 top-1/2 w-56 -translate-y-1/2 rounded-xl p-3 text-left">
            <p className="text-xs font-semibold text-amber">{h.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-sand">{h.body}</p>
          </div>
        ) : null}
      </div>
    </Html>
  );
}

export default function Projector3D({ finish = "#2a2420", shape = "standard", hotspots = [], className }: { finish?: string; shape?: Shape; hotspots?: Hotspot[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [power, setPower] = useState(true);
  const [touched, setTouched] = useState(false);
  return (
    <div className={`relative ${className ?? ""}`}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [3.6, 1.9, 4.6], fov: 34 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onPointerDown={() => setTouched(true)} aria-label="Interactive 3D projector model. Drag to rotate, scroll to zoom.">
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 5]} intensity={2.1} color="#fff1dc" />
        <pointLight position={[-4, 1.5, 3]} intensity={30} color="#f5a83a" distance={12} />
        <pointLight position={[3, -1, -4]} intensity={18} color="#d9772b" distance={10} />
        <spotLight position={[0, 6, 0]} angle={0.5} penumbra={1} intensity={40} color="#ffe6c2" />
        <group position={[0, 0.1, 0]}>
          <Model finish={finish} shape={shape} power={power} />
          {hotspots.map((h) => <Spot key={h.id} h={h} active={active === h.id} onSelect={setActive} />)}
        </group>
        <ContactShadows position={[0, shape === "portable" ? -0.78 : -0.48, 0]} opacity={0.75} scale={9} blur={2.6} far={3} color="#000" />
        <OrbitControls enablePan={false} minDistance={3.4} maxDistance={9} minPolarAngle={0.5} maxPolarAngle={Math.PI / 2 - 0.03} autoRotate={!touched && !active} autoRotateSpeed={0.9} enableDamping />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-between px-4">
        <span className="rounded-full bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-ash backdrop-blur">Drag to rotate · scroll to zoom</span>
        <button onClick={() => setPower((p) => !p)} className="pointer-events-auto rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sand backdrop-blur transition-colors hover:border-amber hover:text-amber" aria-pressed={power}>
          Lamp {power ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
