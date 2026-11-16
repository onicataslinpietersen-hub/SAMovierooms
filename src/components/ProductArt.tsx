import { useId } from "react";

/**
 * Studio-lit product illustrations, drawn in SVG.
 * Used whenever a product has no supplier photography yet (always the case for the sample catalogue),
 * so the store never ships with broken or borrowed imagery. Real images replace these automatically.
 */
const mix = (c: string, pct: number, w: "white" | "black") => `color-mix(in oklab, ${c} ${pct}%, ${w})`;

export function ProductArt({ kind, finish, className, label }: { kind: string; finish?: string | null; className?: string; label?: string }) {
  const id = useId().replace(/:/g, "");
  const c = finish || "#2b2622";
  const hi = mix(c, 72, "white"), lo = mix(c, 55, "black"), mid = mix(c, 90, "white");
  const body = `url(#b${id})`, lens = `url(#l${id})`, amber = "#f5a83a";

  const art: Record<string, React.ReactNode> = {
    projector: (
      <g>
        <rect x="70" y="118" width="260" height="92" rx="20" fill={body} />
        <rect x="70" y="118" width="260" height="30" rx="20" fill={hi} opacity=".22" />
        <rect x="70" y="196" width="260" height="14" rx="7" fill={lo} />
        <circle cx="140" cy="164" r="40" fill="#0a0908" stroke={hi} strokeWidth="3" />
        <circle cx="140" cy="164" r="30" fill={lens} />
        <circle cx="140" cy="164" r="13" fill="#0a0908" />
        <circle cx="130" cy="153" r="6" fill="#fff" opacity=".55" />
        <circle cx="140" cy="164" r="36" fill="none" stroke={amber} strokeWidth="1.2" opacity=".7" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={214 + i * 14} y="146" width="6" height="36" rx="3" fill={lo} />)}
        <circle cx="306" cy="132" r="3.5" fill={amber} />
        <rect x="96" y="210" width="26" height="8" rx="3" fill={lo} /><rect x="278" y="210" width="26" height="8" rx="3" fill={lo} />
      </g>
    ),
    "projector-ust": (
      <g>
        <rect x="56" y="150" width="288" height="62" rx="16" fill={body} />
        <rect x="56" y="150" width="288" height="20" rx="14" fill={hi} opacity=".2" />
        <path d="M150 150 h100 l-14 -16 h-72 z" fill={lo} />
        <ellipse cx="200" cy="138" rx="30" ry="6" fill={lens} />
        <path d="M172 136 L96 40 H304 L228 136 Z" fill={`url(#beam${id})`} opacity=".8" />
        <rect x="76" y="180" width="248" height="22" rx="6" fill="#0a0908" opacity=".7" />
        {Array.from({ length: 30 }).map((_, i) => <circle key={i} cx={84 + i * 8} cy="191" r="1.6" fill={mid} opacity=".6" />)}
        <circle cx="326" cy="162" r="3" fill={amber} />
      </g>
    ),
    "projector-portable": (
      <g>
        <path d="M150 70 q50 -46 100 0" fill="none" stroke={hi} strokeWidth="9" strokeLinecap="round" />
        <rect x="132" y="76" width="136" height="150" rx="34" fill={body} />
        <rect x="132" y="76" width="136" height="44" rx="30" fill={hi} opacity=".18" />
        <circle cx="200" cy="128" r="34" fill="#0a0908" stroke={hi} strokeWidth="3" />
        <circle cx="200" cy="128" r="25" fill={lens} />
        <circle cx="200" cy="128" r="10" fill="#0a0908" />
        <circle cx="191" cy="119" r="5" fill="#fff" opacity=".55" />
        {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 11 }).map((_, i) => <circle key={`${r}-${i}`} cx={150 + i * 10} cy={178 + r * 9} r="2" fill={lo} />))}
        <circle cx="200" cy="128" r="31" fill="none" stroke={amber} strokeWidth="1" opacity=".7" />
      </g>
    ),
    tv: (
      <g>
        <rect x="40" y="52" width="320" height="184" rx="8" fill="#0a0908" stroke={hi} strokeWidth="2.5" />
        <rect x="47" y="59" width="306" height="170" rx="4" fill={`url(#scr${id})`} />
        <path d="M47 190 q70 -50 150 -18 t156 -30 v87 h-306 z" fill="#1a0d06" opacity=".75" />
        <circle cx="286" cy="104" r="20" fill="#ffd89a" opacity=".9" />
        <path d="M150 236 l-22 22 h144 l-22 -22" fill={lo} />
        <rect x="118" y="256" width="164" height="6" rx="3" fill={hi} opacity=".6" />
      </g>
    ),
    soundbar: (
      <g>
        <rect x="36" y="150" width="328" height="50" rx="25" fill={body} />
        <rect x="36" y="150" width="328" height="18" rx="16" fill={hi} opacity=".18" />
        {Array.from({ length: 3 }).map((_, r) => Array.from({ length: 34 }).map((_, i) => <circle key={`${r}-${i}`} cx={62 + i * 8.4} cy={166 + r * 9} r="2" fill={lo} />))}
        <circle cx="200" cy="158" r="2.5" fill={amber} />
        <rect x="252" y="98" width="70" height="46" rx="10" fill={body} opacity=".85" /><circle cx="287" cy="121" r="13" fill="#0a0908" stroke={hi} />
      </g>
    ),
    speakers: (
      <g>
        {[[70, 96, 44, 126], [286, 96, 44, 126]].map(([x, y, w, h], i) => (
          <g key={i}><rect x={x} y={y} width={w} height={h} rx="8" fill={body} /><circle cx={x + w / 2} cy={y + 34} r="12" fill="#0a0908" stroke={hi} /><circle cx={x + w / 2} cy={y + 84} r="17" fill="#0a0908" stroke={hi} /><circle cx={x + w / 2} cy={y + 84} r="6" fill={mid} /></g>
        ))}
        <rect x="150" y="148" width="100" height="74" rx="10" fill={body} /><circle cx="200" cy="185" r="26" fill="#0a0908" stroke={hi} strokeWidth="2" /><circle cx="200" cy="185" r="9" fill={mid} />
        <rect x="160" y="104" width="80" height="30" rx="8" fill={body} /><circle cx="180" cy="119" r="8" fill="#0a0908" stroke={hi} /><circle cx="220" cy="119" r="8" fill="#0a0908" stroke={hi} />
      </g>
    ),
    subwoofer: (
      <g>
        <rect x="118" y="70" width="164" height="164" rx="18" fill={body} />
        <rect x="118" y="70" width="164" height="40" rx="18" fill={hi} opacity=".15" />
        <circle cx="200" cy="152" r="60" fill="#0a0908" stroke={hi} strokeWidth="3" />
        <circle cx="200" cy="152" r="44" fill={lo} /><circle cx="200" cy="152" r="18" fill={mid} />
        <circle cx="200" cy="152" r="52" fill="none" stroke={amber} strokeWidth="1" opacity=".5" />
        <rect x="134" y="234" width="20" height="8" rx="3" fill={lo} /><rect x="246" y="234" width="20" height="8" rx="3" fill={lo} />
      </g>
    ),
    screen: (
      <g>
        <rect x="52" y="40" width="296" height="16" rx="8" fill={body} />
        <rect x="64" y="56" width="272" height="160" fill="#e9e4da" />
        <rect x="64" y="56" width="272" height="160" fill={`url(#scr${id})`} opacity=".5" />
        <rect x="64" y="56" width="272" height="160" fill="none" stroke="#0a0908" strokeWidth="6" />
        <rect x="64" y="216" width="272" height="10" rx="3" fill={lo} />
        <circle cx="200" cy="238" r="5" fill="none" stroke={hi} strokeWidth="2" /><path d="M200 226 v8" stroke={hi} strokeWidth="2" />
      </g>
    ),
    mount: (
      <g>
        <rect x="150" y="44" width="100" height="14" rx="4" fill={body} />
        <rect x="192" y="58" width="16" height="92" rx="4" fill={hi} />
        <circle cx="200" cy="156" r="16" fill={body} stroke={hi} strokeWidth="2" />
        <path d="M200 160 L120 216 M200 160 L280 216 M200 160 L160 228 M200 160 L240 228" stroke={mid} strokeWidth="9" strokeLinecap="round" />
        {[[120, 216], [280, 216], [160, 228], [240, 228]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="6" fill={amber} opacity=".85" />)}
      </g>
    ),
    tripod: (
      <g>
        <rect x="168" y="54" width="64" height="12" rx="4" fill={body} /><circle cx="200" cy="78" r="12" fill={hi} />
        <rect x="194" y="84" width="12" height="70" rx="4" fill={mid} />
        <path d="M200 150 L122 248 M200 150 L278 248 M200 150 L200 252" stroke={body} strokeWidth="10" strokeLinecap="round" />
        <path d="M200 150 L122 248 M200 150 L278 248 M200 150 L200 252" stroke={hi} strokeWidth="2" strokeLinecap="round" opacity=".4" />
        <circle cx="200" cy="150" r="9" fill={amber} opacity=".8" />
      </g>
    ),
    cable: (
      <g>
        <path d="M96 96 C 60 200, 180 250, 200 170 S 330 80, 304 204" fill="none" stroke={mid} strokeWidth="10" strokeLinecap="round" />
        <path d="M96 96 C 60 200, 180 250, 200 170 S 330 80, 304 204" fill="none" stroke={lo} strokeWidth="10" strokeLinecap="round" strokeDasharray="2 7" />
        <g transform="rotate(-18 96 80)"><rect x="76" y="52" width="40" height="42" rx="6" fill={body} /><rect x="82" y="36" width="28" height="18" rx="2" fill={amber} /></g>
        <g transform="rotate(12 304 222)"><rect x="284" y="204" width="40" height="42" rx="6" fill={body} /><rect x="290" y="244" width="28" height="18" rx="2" fill={amber} /></g>
      </g>
    ),
    streamer: (
      <g>
        <rect x="130" y="126" width="140" height="48" rx="14" fill={body} /><rect x="130" y="126" width="140" height="16" rx="12" fill={hi} opacity=".2" />
        <rect x="270" y="138" width="30" height="24" rx="3" fill={amber} />
        <circle cx="154" cy="150" r="3" fill={amber} />
        <path d="M130 150 h-30 q-16 0 -16 16 v40" fill="none" stroke={mid} strokeWidth="5" strokeLinecap="round" />
        {[14, 24, 34].map((r) => <path key={r} d={`M${200 - r} ${112} a${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke={amber} strokeWidth="2.5" strokeLinecap="round" opacity={0.9 - r / 60} />)}
      </g>
    ),
    remote: (
      <g transform="rotate(14 200 150)">
        <rect x="164" y="40" width="72" height="220" rx="30" fill={body} /><rect x="164" y="40" width="72" height="60" rx="30" fill={hi} opacity=".16" />
        <circle cx="200" cy="72" r="6" fill={amber} />
        <circle cx="200" cy="124" r="24" fill="#0a0908" stroke={hi} strokeWidth="2" /><circle cx="200" cy="124" r="9" fill={mid} />
        {[0, 1, 2].map((r) => [0, 1].map((i) => <circle key={`${r}${i}`} cx={186 + i * 28} cy={172 + r * 24} r="7" fill={lo} stroke={hi} strokeOpacity=".4" />))}
      </g>
    ),
    lighting: (
      <g>
        <path d="M60 210 C 100 60, 300 60, 340 210" fill="none" stroke={amber} strokeWidth="22" strokeLinecap="round" opacity=".18" filter={`url(#blur${id})`} />
        <path d="M60 210 C 100 60, 300 60, 340 210" fill="none" stroke={body} strokeWidth="10" strokeLinecap="round" />
        <path d="M60 210 C 100 60, 300 60, 340 210" fill="none" stroke="#ffd89a" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 13" />
        <rect x="318" y="206" width="44" height="26" rx="6" fill={body} /><circle cx="350" cy="219" r="3" fill={amber} />
      </g>
    ),
  };
  art.package = art.speakers;

  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label={label ?? `${kind} illustration`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: hi }} /><stop offset=".45" style={{ stopColor: c }} /><stop offset="1" style={{ stopColor: lo }} /></linearGradient>
        <radialGradient id={`l${id}`} cx=".35" cy=".3"><stop offset="0" stopColor="#ffe9c4" /><stop offset=".35" stopColor="#f5a83a" /><stop offset=".7" stopColor="#5a2c0c" /><stop offset="1" stopColor="#0a0908" /></radialGradient>
        <linearGradient id={`scr${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1436" /><stop offset=".45" stopColor="#b8481f" /><stop offset=".75" stopColor="#f5a83a" /><stop offset="1" stopColor="#3a1a08" /></linearGradient>
        <linearGradient id={`beam${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffd89a" stopOpacity=".55" /><stop offset="1" stopColor="#ffd89a" stopOpacity="0" /></linearGradient>
        <radialGradient id={`fl${id}`}><stop offset="0" stopColor="#f5a83a" stopOpacity=".3" /><stop offset="1" stopColor="#f5a83a" stopOpacity="0" /></radialGradient>
        <filter id={`blur${id}`}><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <ellipse cx="200" cy="256" rx="170" ry="26" fill={`url(#fl${id})`} />
      <ellipse cx="200" cy="254" rx="110" ry="9" fill="#000" opacity=".55" filter={`url(#blur${id})`} />
      {art[kind] ?? art.projector}
    </svg>
  );
}
