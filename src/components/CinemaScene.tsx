/**
 * The SAMovierooms private cinema, drawn as layered SVG so it can be parallaxed and animated cheaply
 * (no bitmap downloads, no WebGL on the critical path). All imagery is original.
 */
const VB = "0 0 1600 900";
const cls = "absolute inset-0 h-full w-full";

/** The picture on the screen: an original dusk-over-dunes "film still", slowly drifting. */
function FilmContents({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#170a2b" /><stop offset=".38" stopColor="#5b1f4a" /><stop offset=".62" stopColor="#d2562a" /><stop offset=".8" stopColor="#f7b455" /><stop offset="1" stopColor="#fbe0a6" />
        </linearGradient>
        <radialGradient id={`${id}sun`}><stop offset="0" stopColor="#fff6dc" /><stop offset=".35" stopColor="#ffd485" /><stop offset="1" stopColor="#ffb14a" stopOpacity="0" /></radialGradient>
      </defs>
      <g className="animate-drift" style={{ transformOrigin: "400px 225px" }}>
        <rect x="-60" y="-40" width="920" height="530" fill={`url(#${id}sky)`} />
        {[[90, 60], [210, 38], [330, 84], [520, 44], [660, 70], [740, 30], [440, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 1.8} fill="#fff" opacity=".7" />)}
        <circle cx="540" cy="292" r="150" fill={`url(#${id}sun)`} />
        <circle cx="540" cy="292" r="44" fill="#fff3d0" />
        <path d="M-60 330 Q150 270 320 318 T640 300 T860 322 V490 H-60Z" fill="#8a3a1c" />
        <path d="M-60 362 Q200 318 380 356 T860 340 V490 H-60Z" fill="#4f1f12" />
        <path d="M-60 402 Q260 360 470 396 T860 384 V490 H-60Z" fill="#1f0d09" />
      </g>
    </>
  );
}

/** The picture on the screen: an original dusk-over-dunes "film still", slowly drifting. */
export function SceneFilm({ id = "f", className = "h-full w-full" }: { id?: string; className?: string }) {
  return (
    <svg viewBox="0 0 800 450" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <FilmContents id={id} />
    </svg>
  );
}

export function SceneRoom() {
  return (
    <svg viewBox={VB} className={cls} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1410" /><stop offset="1" stopColor="#0c0907" /></linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b130d" /><stop offset="1" stopColor="#060504" /></linearGradient>
        <linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#050403" /><stop offset="1" stopColor="#15100c" /></linearGradient>
        <radialGradient id="spill" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#f5a83a" stopOpacity=".42" /><stop offset=".55" stopColor="#d9772b" stopOpacity=".12" /><stop offset="1" stopColor="#d9772b" stopOpacity="0" /></radialGradient>
        <linearGradient id="cove" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffbe63" stopOpacity=".75" /><stop offset="1" stopColor="#ffbe63" stopOpacity="0" /></linearGradient>
        <linearGradient id="refl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5a83a" stopOpacity=".34" /><stop offset="1" stopColor="#f5a83a" stopOpacity="0" /></linearGradient>
        <radialGradient id="sconce"><stop offset="0" stopColor="#ffd08a" stopOpacity=".9" /><stop offset=".3" stopColor="#f5a83a" stopOpacity=".35" /><stop offset="1" stopColor="#f5a83a" stopOpacity="0" /></radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>
      {/* back wall + ceiling + floor */}
      <rect width="1600" height="900" fill="#070605" />
      <rect x="190" y="110" width="1220" height="530" fill="url(#wall)" />
      <path d="M0 0 H1600 L1410 110 H190 Z" fill="#0a0806" />
      <path d="M190 640 H1410 L1600 900 H0 Z" fill="url(#floor)" />
      {/* side walls with acoustic slats */}
      <path d="M0 0 L190 110 V640 L0 900 Z" fill="url(#side)" />
      <g transform="translate(1600 0) scale(-1 1)"><path d="M0 0 L190 110 V640 L0 900 Z" fill="url(#side)" /></g>
      {[40, 80, 120, 160].map((x) => (
        <g key={x} opacity=".5">
          <path d={`M${x} ${x * 0.58} V${900 - x * 1.37}`} stroke="#241a12" strokeWidth="3" />
          <path d={`M${1600 - x} ${x * 0.58} V${900 - x * 1.37}`} stroke="#241a12" strokeWidth="3" />
        </g>
      ))}
      {/* ceiling cove lighting */}
      <rect x="190" y="110" width="1220" height="90" fill="url(#cove)" opacity=".5" className="animate-flicker" />
      <rect x="190" y="108" width="1220" height="3" fill="#ffd08a" />
      {/* ceiling downlights */}
      {[420, 800, 1180].map((x) => <g key={x}><ellipse cx={x} cy="52" rx="16" ry="5" fill="#ffd08a" opacity=".8" /><ellipse cx={x} cy="60" rx="60" ry="22" fill="url(#sconce)" opacity=".5" /></g>)}
      {/* screen light spilling on the wall */}
      <ellipse cx="800" cy="400" rx="640" ry="330" fill="url(#spill)" className="animate-flicker" />
      {/* wall sconces */}
      {[[110, 330], [1490, 330]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r="120" fill="url(#sconce)" opacity=".7" /><rect x={x - 5} y={y - 26} width="10" height="52" rx="5" fill="#ffe1ad" /></g>)}
      {/* floor: screen reflection + plank lines */}
      <path d="M400 640 H1200 L1320 900 H280 Z" fill="url(#refl)" filter="url(#soft)" />
      {[-560, -330, -110, 110, 330, 560].map((dx) => <path key={dx} d={`M${800 + dx * 0.72} 640 L${800 + dx * 1.5} 900`} stroke="#000" strokeOpacity=".35" strokeWidth="2" />)}
      {/* skirting LED */}
      <rect x="190" y="636" width="1220" height="4" fill="#f5a83a" opacity=".85" />
      <rect x="190" y="610" width="1220" height="30" fill="url(#cove)" opacity=".25" transform="translate(0 1250) scale(1 -1)" />
      {/* the screen */}
      <rect x="392" y="162" width="816" height="466" rx="4" fill="#050403" />
      <svg x="400" y="170" width="800" height="450" viewBox="0 0 800 450" overflow="hidden"><FilmContents id="room" /></svg>
      <rect x="400" y="170" width="800" height="450" fill="none" stroke="#ffe6b8" strokeOpacity=".25" />
      {/* speakers flanking the screen */}
      {[330, 1226].map((x) => <g key={x}><rect x={x} y="330" width="44" height="300" rx="6" fill="#0b0908" stroke="#2a1f16" /><circle cx={x + 22} cy="380" r="11" fill="#17110c" stroke="#3a2a1c" /><circle cx={x + 22} cy="450" r="15" fill="#17110c" stroke="#3a2a1c" /><circle cx={x + 22} cy="530" r="15" fill="#17110c" stroke="#3a2a1c" /></g>)}
      {/* low cabinet */}
      <rect x="560" y="604" width="480" height="34" rx="4" fill="#0e0a08" stroke="#2a1f16" />
    </svg>
  );
}

/** Seating silhouettes with a warm rim light — the closest layer to the camera. */
export function SceneSeats() {
  return (
    <svg viewBox={VB} className={cls} preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c130d" /><stop offset="1" stopColor="#040303" /></linearGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5a83a" stopOpacity=".9" /><stop offset="1" stopColor="#f5a83a" stopOpacity="0" /></linearGradient>
      </defs>
      {[250, 560, 870].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i === 1 ? 0 : 14})`}>
          <path d="M0 900 V790 q0 -62 62 -62 h156 q62 0 62 62 V900 Z" fill="url(#seat)" />
          <path d="M6 792 q0 -58 58 -58 h152 q58 0 58 58" fill="none" stroke="url(#rim)" strokeWidth="3" />
          <rect x="-26" y="812" width="40" height="88" rx="14" fill="#090605" /><rect x="266" y="812" width="40" height="88" rx="14" fill="#090605" />
        </g>
      ))}
      <rect y="880" width="1600" height="20" fill="#040303" />
    </svg>
  );
}

/** Projector beam with drifting dust. `from` is the lens position in the 1600×900 scene. */
export function SceneBeam({ from = [1290, 742] as [number, number] }) {
  const [x, y] = from;
  return (
    <svg viewBox={VB} className={cls} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="beamg" gradientUnits="userSpaceOnUse" x1={x} y1={y} x2="800" y2="400"><stop offset="0" stopColor="#ffe6b8" stopOpacity=".5" /><stop offset=".7" stopColor="#ffd08a" stopOpacity=".1" /><stop offset="1" stopColor="#ffd08a" stopOpacity=".02" /></linearGradient>
        <filter id="beamblur"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <path d={`M${x} ${y} L400 170 L1200 170 L1200 620 Z`} fill="url(#beamg)" filter="url(#beamblur)" className="animate-flicker" style={{ mixBlendMode: "screen" }} />
      {Array.from({ length: 16 }).map((_, i) => (
        <circle key={i} cx={720 + ((i * 97) % 520)} cy={330 + ((i * 53) % 330)} r={1 + (i % 3) * 0.7} fill="#ffe6b8" className="animate-dust" style={{ animationDelay: `${-i * 0.9}s`, animationDuration: `${10 + (i % 5) * 2}s` }} />
      ))}
    </svg>
  );
}
