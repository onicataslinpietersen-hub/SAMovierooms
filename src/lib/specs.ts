/**
 * Structured product specifications + the rules that decide which marketing claims a product may carry.
 * A claim is only ever derived from a structured spec field — never from free text.
 */
export type Specs = {
  // Display
  native_resolution?: string;        // e.g. "3840x2160" — the panel/chip's true pixel count
  max_input_resolution?: string;     // highest signal accepted
  brightness_value?: number;
  brightness_unit?: "ANSI lumens" | "ISO lumens" | "nits";
  contrast_ratio?: string;
  projection_size?: string;
  throw_ratio?: string;
  throw_distance?: string;
  light_source?: string;
  light_source_life?: string;
  screen_size?: string;
  panel_type?: string;
  refresh_rate?: string;
  hdr?: string;
  // Platform
  operating_system?: string;
  connectivity?: string[];
  wireless?: string[];
  speakers?: string;
  audio_channels?: string;
  audio_power?: string;
  battery?: string;
  // Power — important for imports into South Africa (230 V / 50 Hz, SANS 164 plugs)
  input_voltage?: string;
  plug_type?: string;
  // Anything else, shown verbatim under "Additional specifications"
  extra?: Record<string, string>;
};

export type ResolutionClass = "native_4k" | "4k_supported" | "full_hd" | "hd" | "other" | "unknown";

function pixels(res?: string): [number, number] | null {
  if (!res) return null;
  const m = res.toLowerCase().replace(/\s/g, "").match(/^(\d{3,5})[x×](\d{3,5})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Native 4K means the *native* resolution is at least 3840×2160. Accepting a 4K signal does not count. */
export function resolutionClass(s: Specs): ResolutionClass {
  const native = pixels(s.native_resolution);
  const input = pixels(s.max_input_resolution);
  if (!native) return "unknown";
  if (native[0] >= 3840 && native[1] >= 2160) return "native_4k";
  if (input && input[0] >= 3840 && input[1] >= 2160) return "4k_supported";
  if (native[0] >= 1920 && native[1] >= 1080) return "full_hd";
  if (native[0] >= 1280 && native[1] >= 720) return "hd";
  return "other";
}

export const RESOLUTION_LABEL: Record<ResolutionClass, string> = {
  native_4k: "Native 4K",
  "4k_supported": "4K input supported",
  full_hd: "Full HD",
  hd: "HD",
  other: "",
  unknown: "",
};

export const RESOLUTION_EXPLAINER: Record<ResolutionClass, string> = {
  native_4k: "True 3840 × 2160 native resolution — every pixel of a 4K source is displayed.",
  "4k_supported": "Accepts a 4K signal and displays it at the projector's native resolution shown below. This is not a native 4K projector.",
  full_hd: "1920 × 1080 native resolution.",
  hd: "1280 × 720 native resolution.",
  other: "",
  unknown: "",
};

/** "Crystal-Clear 4K Entertainment" may only be used when specs are verified AND the panel is native 4K. */
export function mayClaimCrystalClear4K(s: Specs, specsVerified: boolean): boolean {
  return specsVerified && resolutionClass(s) === "native_4k";
}

export function prettyRes(res?: string): string {
  const p = pixels(res);
  return p ? `${p[0]} × ${p[1]}` : res ?? "";
}

/** Rows for the spec table, grouped. Only fields that are actually present are returned. */
export function specGroups(s: Specs): { group: string; rows: [string, string][] }[] {
  const row = (label: string, v?: string | string[] | number | null): [string, string] | null =>
    v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) ? null : [label, Array.isArray(v) ? v.join(" · ") : String(v)];
  const groups: { group: string; rows: ([string, string] | null)[] }[] = [
    { group: "Display", rows: [
      row("Native resolution", prettyRes(s.native_resolution)),
      row("Maximum supported input", prettyRes(s.max_input_resolution)),
      row("Brightness", s.brightness_value ? `${s.brightness_value.toLocaleString("en-ZA")} ${s.brightness_unit ?? ""}`.trim() : undefined),
      row("Contrast ratio", s.contrast_ratio),
      row("Screen size", s.screen_size),
      row("Panel", s.panel_type),
      row("Refresh rate", s.refresh_rate),
      row("HDR", s.hdr),
      row("Projection size", s.projection_size),
      row("Throw ratio", s.throw_ratio),
      row("Throw distance", s.throw_distance),
      row("Light source", s.light_source),
      row("Light source life", s.light_source_life),
    ]},
    { group: "Sound", rows: [row("Speakers", s.speakers), row("Channels", s.audio_channels), row("Output power", s.audio_power)] },
    { group: "Smart & connectivity", rows: [row("Operating system", s.operating_system), row("Ports", s.connectivity), row("Wireless", s.wireless)] },
    { group: "Power", rows: [row("Input voltage", s.input_voltage), row("Plug", s.plug_type), row("Battery", s.battery)] },
    { group: "Additional specifications", rows: Object.entries(s.extra ?? {}).map(([k, v]) => row(k, v)) },
  ];
  return groups.map((g) => ({ group: g.group, rows: g.rows.filter((r): r is [string, string] => !!r) })).filter((g) => g.rows.length);
}

/** South African mains is 230 V / 50 Hz. Returns a customer-facing compatibility note derived from the spec. */
export function powerCompatibility(s: Specs): { ok: boolean | null; note: string } {
  const v = s.input_voltage;
  if (!v) return { ok: null, note: "Input voltage has not been confirmed for this product. Ask us before ordering." };
  const nums = (v.match(/\d{2,3}/g) ?? []).map(Number);
  if (/usb|battery|dc/i.test(v) && !nums.some((n) => n >= 100)) return { ok: true, note: `Powered via ${v}.` };
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const ok = nums.length > 0 && lo <= 230 && hi >= 230;
  const plug = s.plug_type ? ` Plug: ${s.plug_type}.` : " Plug type not confirmed — a plug adapter may be required.";
  return ok
    ? { ok: true, note: `${v} — compatible with South African 230 V / 50 Hz mains.${plug}` }
    : { ok: false, note: `${v} — NOT directly compatible with South African 230 V mains.` };
}
